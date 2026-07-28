import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarDayOffset,
  shiftMediaPlanDataToScheduledStart,
} from "./media-plan-date-offset";
import type { MediaPlanData, MediaPlanWeek } from "./generators/media-plan";
import { formatShortCampaignDate } from "./generators/media-plan";
import { dateForCampaignSlot } from "./media-plan-week-range";
import {
  PUBLISHING_CALENDAR_DAYS,
  parseIsoCampaignDate,
  resolveScheduledStartDate,
} from "./media-plan-week-start";

function fixtureWeek(
  week: number,
  scheduledIso: string,
  creatorId: string,
  creator: string
): MediaPlanWeek {
  const start = parseIsoCampaignDate(scheduledIso)!;
  const days = PUBLISHING_CALENDAR_DAYS.map((day, dayIndex) => ({
    day,
    dateLabel: formatShortCampaignDate(dateForCampaignSlot(start, week, dayIndex)),
    type: "content" as const,
    label: creator,
    creatorId,
    creator,
    shortName: creator.split(" ")[0],
    serviceType: "Reel",
    platform: "Instagram",
  }));
  return { week, wave: 1, phase: "Launch", days };
}

function fixturePlan(scheduledIso: string, requestedIso?: string): MediaPlanData {
  return {
    durationWeeks: 2,
    calendarWeeks: 2,
    campaignStartDate: scheduledIso,
    scheduledStartDate: scheduledIso,
    requestedStartDate: requestedIso ?? scheduledIso,
    campaignEndDate: undefined,
    weeks: [
      fixtureWeek(1, scheduledIso, "c1", "Eman Abdullah"),
      fixtureWeek(2, scheduledIso, "c2", "Sara Ali"),
    ],
    waves: [{ wave: 1, weeks: [1, 2], theme: "Launch", creatorCount: 2, activationCount: 14 }],
    milestones: [{ type: "client_approval", week: 1, label: "Client approval" }],
    platformAllocation: { Instagram: 14 },
    dependencies: [],
    deadlines: [],
    creatorCount: 2,
    postingSlotCount: 14,
    serviceTypes: ["Reel"],
    generatorVersion: "test",
  };
}

function slotSnapshot(data: MediaPlanData) {
  return data.weeks.map((week) =>
    week.days.map((day) => ({
      creatorId: day.creatorId,
      creator: day.creator,
      serviceType: day.serviceType,
      platform: day.platform,
      type: day.type,
      label: day.label,
    }))
  );
}

test("calendarDayOffset: forward and backward", () => {
  assert.equal(calendarDayOffset("2026-07-25", "2026-08-01"), 7);
  assert.equal(calendarDayOffset("2026-08-01", "2026-07-25"), -7);
});

test("shift forward preserves creators and publishing order", () => {
  const before = fixturePlan("2026-07-25");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-08-01", {
    requestedStartDate: "2026-08-01",
  });

  assert.equal(after.campaignStartDate, "2026-08-01");
  assert.equal(after.scheduledStartDate, "2026-08-01");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
  assert.deepEqual(after.waves, before.waves);
  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "1/8/26");
  assert.equal(after.weeks[0]!.days[6]!.dateLabel, "7/8/26");
});

test("shift backward preserves creators and publishing order", () => {
  const before = fixturePlan("2026-08-01");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-07-25", {
    requestedStartDate: "2026-07-25",
  });

  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "25/7/26");
  assert.equal(after.weeks[1]!.days[0]!.dateLabel, "1/8/26");
});

test("month boundary: July → August labels", () => {
  const before = fixturePlan("2026-07-25");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-08-29", {
    requestedStartDate: "2026-08-29",
  });

  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "29/8/26");
  assert.equal(after.weeks[0]!.days[1]!.dateLabel, "30/8/26");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
});

test("year boundary: December → January", () => {
  const before = fixturePlan("2026-12-26");
  const after = shiftMediaPlanDataToScheduledStart(before, "2027-01-02", {
    requestedStartDate: "2027-01-02",
  });

  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "2/1/27");
  assert.equal(after.weeks[0]!.days[6]!.dateLabel, "8/1/27");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
});

test("leap year: Week 1 Saturday–Friday includes 29 Feb 2024", () => {
  // Sat 24 Feb 2024 → Thu (index 5) is 29 Feb 2024
  const before = fixturePlan("2024-01-06");
  const after = shiftMediaPlanDataToScheduledStart(before, "2024-02-24", {
    requestedStartDate: "2024-02-24",
  });

  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "24/2/24");
  assert.equal(after.weeks[0]!.days[5]!.dateLabel, "29/2/24");
  assert.equal(after.weeks[0]!.days[6]!.dateLabel, "1/3/24");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
});

test("mid-week start: Friday request opens on prior Saturday", () => {
  const requested = "2026-07-24"; // Friday
  const scheduled = resolveScheduledStartDate(requested);
  assert.equal(scheduled, "2026-07-18");

  const before = fixturePlan("2026-07-04", "2026-07-04");
  const after = shiftMediaPlanDataToScheduledStart(before, scheduled!, {
    requestedStartDate: requested,
  });

  assert.equal(after.requestedStartDate, requested);
  assert.equal(after.scheduledStartDate, "2026-07-18");
  assert.equal(after.weeks[0]!.days[0]!.day, "Saturday");
  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "18/7/26");
  assert.equal(after.weeks[0]!.days[6]!.dateLabel, "24/7/26");
});

test("Sunday request opens on prior Saturday", () => {
  assert.equal(resolveScheduledStartDate("2026-07-26"), "2026-07-25");
});

test("deadlines rebuild from shifted publish calendar", () => {
  const before = fixturePlan("2026-07-25");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-08-01", {
    requestedStartDate: "2026-08-01",
  });
  assert.ok(after.deadlines.length > 0);
  assert.ok(after.deadlines.every((row) => row.publishWeek >= 1));
  assert.equal(after.deadlines[0]!.creator, "Eman Abdullah");
});

test("campaign_relative_week mode is rejected until implemented", () => {
  const before = fixturePlan("2026-07-25");
  assert.throws(
    () =>
      shiftMediaPlanDataToScheduledStart(before, "2026-07-28", {
        schedulingMode: "campaign_relative_week",
      }),
    /not implemented/
  );
});
