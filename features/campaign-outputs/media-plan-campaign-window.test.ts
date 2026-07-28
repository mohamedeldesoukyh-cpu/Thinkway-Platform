import assert from "node:assert/strict";
import test from "node:test";

import type { MediaPlanData, MediaPlanWeek } from "./generators/media-plan";
import { formatShortCampaignDate } from "./generators/media-plan";
import {
  MediaPlanCampaignWindowError,
  assertMediaPlanWithinCampaignWindow,
  assertScheduleTargetWithinCampaignWindow,
  enforceMediaPlanCampaignWindow,
  findCampaignWindowViolations,
  rebalanceMediaPlanWithinCampaignWindow,
  resolveCampaignWindowFromMediaPlan,
} from "./media-plan-campaign-window";
import { dateForCampaignSlot } from "./media-plan-week-range";
import {
  PUBLISHING_CALENDAR_DAYS,
  parseIsoCampaignDate,
} from "./media-plan-week-start";

function emptyWeek(week: number, gridStartIso: string): MediaPlanWeek {
  const start = parseIsoCampaignDate(gridStartIso)!;
  return {
    week,
    wave: 1,
    phase: "Launch",
    days: PUBLISHING_CALENDAR_DAYS.map((day, dayIndex) => ({
      day,
      dateLabel: formatShortCampaignDate(dateForCampaignSlot(start, week, dayIndex)),
      type: "content" as const,
      label: "",
    })),
  };
}

function planWithCreatorOnDay(
  gridStartIso: string,
  requestedStartIso: string,
  campaignEndIso: string,
  dayIndex: number,
  creatorId = "c1",
  creator = "Eman Abdullah"
): MediaPlanData {
  const week = emptyWeek(1, gridStartIso);
  week.days[dayIndex] = {
    ...week.days[dayIndex]!,
    label: creator,
    creatorId,
    creator,
    shortName: creator.split(" ")[0],
    serviceType: "Reel",
    platform: "Instagram",
  };
  return {
    durationWeeks: 1,
    calendarWeeks: 1,
    campaignStartDate: gridStartIso,
    scheduledStartDate: gridStartIso,
    requestedStartDate: requestedStartIso,
    campaignEndDate: campaignEndIso,
    weeks: [week],
    waves: [{ wave: 1, weeks: [1], theme: "Launch", creatorCount: 1, activationCount: 1 }],
    milestones: [],
    platformAllocation: { Instagram: 1 },
    dependencies: [],
    deadlines: [],
    creatorCount: 1,
    postingSlotCount: 1,
    serviceTypes: ["Reel"],
    generatorVersion: "test",
  };
}

test("resolveCampaignWindowFromMediaPlan prefers requestedStartDate over grid Saturday", () => {
  const data = planWithCreatorOnDay("2026-07-18", "2026-07-24", "2026-07-24", 6);
  const window = resolveCampaignWindowFromMediaPlan(data);
  assert.deepEqual(window, { startIso: "2026-07-24", endIso: "2026-07-24" });
});

test("findCampaignWindowViolations flags Saturday content before mid-week campaign start", () => {
  const data = planWithCreatorOnDay("2026-07-18", "2026-07-24", "2026-07-24", 0);
  const violations = findCampaignWindowViolations(data);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.dateIso, "2026-07-18");
  assert.equal(violations[0]!.reason, "before_start");
});

test("assertMediaPlanWithinCampaignWindow rejects outside-window slots", () => {
  const data = planWithCreatorOnDay("2026-07-18", "2026-07-24", "2026-07-24", 0);
  assert.throws(
    () => assertMediaPlanWithinCampaignWindow(data),
    (error: unknown) =>
      error instanceof MediaPlanCampaignWindowError &&
      error.code === "CAMPAIGN_WINDOW_VIOLATION" &&
      error.violations.length === 1
  );
});

test("rebalance moves creators into campaign window and clears pre-start days", () => {
  const data = planWithCreatorOnDay("2026-07-18", "2026-07-24", "2026-07-24", 0);
  const balanced = rebalanceMediaPlanWithinCampaignWindow(data);
  assert.equal(findCampaignWindowViolations(balanced).length, 0);
  assert.equal(balanced.weeks[0]!.days[0]!.creatorId, undefined);
  assert.equal(balanced.weeks[0]!.days[6]!.creatorId, "c1");
  assert.equal(balanced.weeks[0]!.days[6]!.creator, "Eman Abdullah");
});

test("enforceMediaPlanCampaignWindow rebalances then passes validation", () => {
  const data = planWithCreatorOnDay("2026-07-18", "2026-07-24", "2026-07-24", 0);
  const enforced = enforceMediaPlanCampaignWindow(data);
  assert.doesNotThrow(() => assertMediaPlanWithinCampaignWindow(enforced));
  assert.equal(enforced.weeks[0]!.days[6]!.creatorId, "c1");
});

test("rebalance is a no-op when already inside the campaign window", () => {
  const data = planWithCreatorOnDay("2026-07-18", "2026-07-24", "2026-07-24", 6);
  const balanced = rebalanceMediaPlanWithinCampaignWindow(data);
  assert.equal(balanced.weeks[0]!.days[6]!.creatorId, "c1");
  assert.equal(balanced.weeks[0]!.days[0]!.creatorId, undefined);
});

test("monitoring-only Performance review outside window is not a violation", () => {
  const data = planWithCreatorOnDay("2026-07-18", "2026-07-24", "2026-07-24", 6);
  data.weeks[0]!.days[0] = {
    day: "Saturday",
    dateLabel: "18/7/26",
    type: "monitoring",
    label: "Performance review",
    serviceType: "Reporting",
  };
  assert.equal(findCampaignWindowViolations(data).length, 0);
});

test("assertScheduleTargetWithinCampaignWindow rejects pre-start target", () => {
  const data = planWithCreatorOnDay("2026-07-18", "2026-07-24", "2026-07-24", 6);
  assert.throws(
    () => assertScheduleTargetWithinCampaignWindow(data, { week: 1, dayIndex: 0 }),
    MediaPlanCampaignWindowError
  );
  assert.doesNotThrow(() =>
    assertScheduleTargetWithinCampaignWindow(data, { week: 1, dayIndex: 6 })
  );
});

test("rebalance preserves creator order when compressing into a short window", () => {
  const grid = "2026-07-18";
  const start = parseIsoCampaignDate(grid)!;
  const week = emptyWeek(1, grid);
  // Place three creators on Sat/Sun/Mon — all before Fri campaign start.
  for (const [dayIndex, id, name] of [
    [0, "c1", "Alpha"] as const,
    [1, "c2", "Bravo"] as const,
    [2, "c3", "Charlie"] as const,
  ]) {
    week.days[dayIndex] = {
      day: PUBLISHING_CALENDAR_DAYS[dayIndex]!,
      dateLabel: formatShortCampaignDate(dateForCampaignSlot(start, 1, dayIndex)),
      type: "content",
      label: name,
      creatorId: id,
      creator: name,
      shortName: name,
      serviceType: "Reel",
      platform: "Instagram",
    };
  }
  const data: MediaPlanData = {
    ...planWithCreatorOnDay(grid, "2026-07-24", "2026-07-24", 6),
    weeks: [week],
    creatorCount: 3,
    postingSlotCount: 3,
    waves: [{ wave: 1, weeks: [1], theme: "Launch", creatorCount: 3, activationCount: 3 }],
  };

  const balanced = enforceMediaPlanCampaignWindow(data);
  assert.equal(findCampaignWindowViolations(balanced).length, 0);
  const friday = balanced.weeks[0]!.days[6]!;
  assert.equal(friday.creatorId, "c1");
  assert.equal(friday.additionalDeliverables?.length, 2);
  assert.equal(friday.additionalDeliverables?.[0]?.creatorId, "c2");
  assert.equal(friday.additionalDeliverables?.[1]?.creatorId, "c3");
});
