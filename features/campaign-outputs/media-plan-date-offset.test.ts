import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarDayOffset,
  firstPublishingSlotIso,
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

/** Week 1 with a single creator on Saturday (dayIndex 0) only. */
function fixtureWeekFirstCreatorOnSaturday(
  scheduledIso: string,
  creatorId: string,
  creator: string
): MediaPlanWeek {
  const start = parseIsoCampaignDate(scheduledIso)!;
  const days = PUBLISHING_CALENDAR_DAYS.map((day, dayIndex) => {
    const dateLabel = formatShortCampaignDate(dateForCampaignSlot(start, 1, dayIndex));
    if (dayIndex === 0) {
      return {
        day,
        dateLabel,
        type: "content" as const,
        label: creator,
        creatorId,
        creator,
        shortName: creator.split(" ")[0],
        serviceType: "Reel",
        platform: "Instagram",
      };
    }
    return {
      day,
      dateLabel,
      type: "content" as const,
      label: "",
    };
  });
  return { week: 1, wave: 1, phase: "Launch", days };
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

test("shift by whole weeks preserves creator sequence on new dates", () => {
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
  assert.equal(after.weeks[0]!.days[0]!.creatorId, "c1");
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

test("shortening campaign end rebinds calendar and clears post-end weeks", () => {
  // Long plan through mid-September; revise end to 23/08/2026.
  const before = fixturePlan("2026-07-18", "2026-07-24");
  before.durationWeeks = 8;
  before.campaignEndDate = "2026-09-18";
  before.calendarWeeks = 2;

  const after = shiftMediaPlanDataToScheduledStart(before, "2026-07-18", {
    requestedStartDate: "2026-07-24",
    campaignEndDate: "2026-08-23",
    durationWeeks: 5,
  });

  assert.equal(after.requestedStartDate, "2026-07-24");
  assert.equal(after.campaignEndDate, "2026-08-23");
  // Last publishing week ends Fri 28/08 (week containing 23/08) — not September.
  const lastWeek = after.weeks[after.weeks.length - 1]!;
  assert.equal(lastWeek.days[6]!.dateLabel, "28/8/26");
  for (const week of after.weeks) {
    for (const day of week.days) {
      if (!day.creatorId && !day.additionalDeliverables?.length) continue;
      // No creator content after 23/08
      const dayNum = Number(day.dateLabel.split("/")[0]);
      const month = Number(day.dateLabel.split("/")[1]);
      assert.ok(
        month < 8 || (month === 8 && dayNum <= 23),
        `creator on ${day.dateLabel} is after campaign end`
      );
    }
  }
});

test("Revision mid-week start rebinds first creator onto campaign start date", () => {
  // Week 1 = 18–24 Jul. First creator was on Sat 18/07.
  // Start changes to Fri 24/07/2026 — same Week 1, creator must move to 24/07.
  const before: MediaPlanData = {
    ...fixturePlan("2026-07-18", "2026-07-18"),
    durationWeeks: 1,
    calendarWeeks: 1,
    weeks: [fixtureWeekFirstCreatorOnSaturday("2026-07-18", "c1", "Eman Abdullah")],
    waves: [{ wave: 1, weeks: [1], theme: "Launch", creatorCount: 1, activationCount: 1 }],
  };

  assert.equal(firstPublishingSlotIso(before), "2026-07-18");
  assert.equal(before.weeks[0]!.days[0]!.creatorId, "c1");
  assert.equal(before.weeks[0]!.days[0]!.dateLabel, "18/7/26");

  const after = shiftMediaPlanDataToScheduledStart(before, "2026-07-18", {
    requestedStartDate: "2026-07-24",
    campaignEndDate: "2026-07-24",
  });

  assert.equal(after.scheduledStartDate, "2026-07-18");
  assert.equal(after.requestedStartDate, "2026-07-24");
  assert.equal(after.weeks.length, 1);
  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "18/7/26");
  assert.equal(after.weeks[0]!.days[6]!.dateLabel, "24/7/26");
  // Rebound: Saturday empty, Friday holds the first creator
  assert.equal(after.weeks[0]!.days[0]!.creatorId, undefined);
  assert.equal(after.weeks[0]!.days[6]!.creatorId, "c1");
  assert.equal(after.weeks[0]!.days[6]!.creator, "Eman Abdullah");
  assert.deepEqual(after.waves, before.waves);
});

test("month boundary: July → August labels with rebound slots", () => {
  const before = fixturePlan("2026-07-25");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-08-29", {
    requestedStartDate: "2026-08-29",
  });

  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "29/8/26");
  assert.equal(after.weeks[0]!.days[0]!.creatorId, "c1");
  assert.equal(after.weeks[0]!.days[1]!.dateLabel, "30/8/26");
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
  const before = fixturePlan("2024-01-06");
  const after = shiftMediaPlanDataToScheduledStart(before, "2024-02-24", {
    requestedStartDate: "2024-02-24",
  });

  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "24/2/24");
  assert.equal(after.weeks[0]!.days[5]!.dateLabel, "29/2/24");
  assert.equal(after.weeks[0]!.days[6]!.dateLabel, "1/3/24");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
});

test("Friday request opens Week 1 on prior Saturday", () => {
  const requested = "2026-07-24";
  const scheduled = resolveScheduledStartDate(requested);
  assert.equal(scheduled, "2026-07-18");
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
