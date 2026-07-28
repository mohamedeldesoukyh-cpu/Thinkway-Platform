import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarDayOffset,
  shiftMediaPlanDataToScheduledStart,
} from "./media-plan-date-offset";
import type { MediaPlanData, MediaPlanWeek } from "./generators/media-plan";
import { formatShortCampaignDate } from "./generators/media-plan";
import { dateForCampaignSlot } from "./media-plan-week-range";
import { parseIsoCampaignDate, resolveScheduledStartDate } from "./media-plan-week-start";

function fixtureWeek(
  week: number,
  scheduledIso: string,
  creatorId: string,
  creator: string
): MediaPlanWeek {
  const start = parseIsoCampaignDate(scheduledIso)!;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
    (day, dayIndex) => ({
      day,
      dateLabel: formatShortCampaignDate(dateForCampaignSlot(start, week, dayIndex)),
      type: "content" as const,
      label: creator,
      creatorId,
      creator,
      shortName: creator.split(" ")[0],
      serviceType: "Reel",
      platform: "Instagram",
    })
  );
  return { week, wave: 1, phase: "Launch", days };
}

function fixturePlan(scheduledIso: string, requestedIso?: string): MediaPlanData {
  return {
    durationWeeks: 2,
    calendarWeeks: 2,
    campaignStartDate: scheduledIso,
    scheduledStartDate: scheduledIso,
    requestedStartDate: requestedIso ?? scheduledIso,
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
  assert.equal(calendarDayOffset("2026-07-27", "2026-08-03"), 7);
  assert.equal(calendarDayOffset("2026-08-03", "2026-07-27"), -7);
});

test("shift forward preserves creators and publishing order", () => {
  const before = fixturePlan("2026-07-27");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-08-03", {
    requestedStartDate: "2026-08-03",
  });

  assert.equal(after.campaignStartDate, "2026-08-03");
  assert.equal(after.scheduledStartDate, "2026-08-03");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
  assert.deepEqual(after.waves, before.waves);
  assert.deepEqual(after.milestones, before.milestones);
  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "3/8/26");
  assert.equal(after.weeks[0]!.days[6]!.dateLabel, "9/8/26");
  assert.equal(calendarDayOffset("2026-07-27", "2026-08-03"), 7);
});

test("shift backward preserves creators and publishing order", () => {
  const before = fixturePlan("2026-08-03");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-07-27", {
    requestedStartDate: "2026-07-27",
  });

  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "27/7/26");
  assert.equal(after.weeks[1]!.days[0]!.dateLabel, "3/8/26");
});

test("month boundary: July → August labels", () => {
  const before = fixturePlan("2026-07-27");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-08-31");

  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "31/8/26");
  assert.equal(after.weeks[0]!.days[1]!.dateLabel, "1/9/26");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
});

test("year boundary: December → January", () => {
  const before = fixturePlan("2026-12-28");
  const after = shiftMediaPlanDataToScheduledStart(before, "2027-01-04");

  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "4/1/27");
  assert.equal(after.weeks[0]!.days[6]!.dateLabel, "10/1/27");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
  assert.equal(calendarDayOffset("2026-12-28", "2027-01-04"), 7);
});

test("leap year: Week 1 includes 29 Feb 2024", () => {
  // Monday 26 Feb 2024 → Thursday is 29 Feb 2024
  const before = fixturePlan("2024-01-01");
  const after = shiftMediaPlanDataToScheduledStart(before, "2024-02-26");

  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "26/2/24");
  assert.equal(after.weeks[0]!.days[3]!.dateLabel, "29/2/24");
  assert.equal(after.weeks[0]!.days[4]!.dateLabel, "1/3/24");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
});

test("weekend start dates: Friday request Monday-aligns before offset", () => {
  const requested = "2026-07-24"; // Friday
  const scheduled = resolveScheduledStartDate(requested);
  assert.equal(scheduled, "2026-07-27");

  const before = fixturePlan("2026-07-06", "2026-07-06");
  const after = shiftMediaPlanDataToScheduledStart(before, scheduled!, {
    requestedStartDate: requested,
  });

  assert.equal(after.requestedStartDate, requested);
  assert.equal(after.scheduledStartDate, "2026-07-27");
  assert.equal(after.weeks[0]!.days[0]!.day, "Monday");
  assert.equal(after.weeks[0]!.days[0]!.dateLabel, "27/7/26");
  assert.deepEqual(slotSnapshot(after), slotSnapshot(before));
});

test("weekend start dates: Sunday request Monday-aligns", () => {
  assert.equal(resolveScheduledStartDate("2026-07-26"), "2026-07-27");
});

test("deadlines rebuild from shifted publish calendar", () => {
  const before = fixturePlan("2026-07-27");
  const after = shiftMediaPlanDataToScheduledStart(before, "2026-08-03");
  assert.ok(after.deadlines.length > 0);
  assert.ok(after.deadlines.every((row) => row.publishWeek >= 1));
  assert.equal(after.deadlines[0]!.creator, "Eman Abdullah");
});

test("campaign_relative_week mode is rejected until implemented", () => {
  const before = fixturePlan("2026-07-27");
  assert.throws(
    () =>
      shiftMediaPlanDataToScheduledStart(before, "2026-07-28", {
        schedulingMode: "campaign_relative_week",
      }),
    /not implemented/
  );
});
