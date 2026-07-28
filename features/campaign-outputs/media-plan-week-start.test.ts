import assert from "node:assert/strict";
import test from "node:test";

import {
  describeMondayAlignment,
  resolveScheduledStartDate,
  startOfCampaignWeek,
  toIsoCampaignDate,
} from "./media-plan-week-start";

test("Friday 24 Jul 2026 snaps Week 1 to Monday 27 Jul 2026", () => {
  assert.equal(resolveScheduledStartDate("2026-07-24"), "2026-07-27");
  const friday = new Date(2026, 6, 24, 12, 0, 0, 0);
  assert.equal(toIsoCampaignDate(startOfCampaignWeek(friday)), "2026-07-27");
});

test("Monday start is unchanged", () => {
  assert.equal(resolveScheduledStartDate("2026-07-27"), "2026-07-27");
});

test("Sunday snaps forward to next Monday", () => {
  assert.equal(resolveScheduledStartDate("2026-07-26"), "2026-07-27");
});

test("alignment message is null when dates match", () => {
  assert.equal(describeMondayAlignment("2026-07-27", "2026-07-27"), null);
});

test("alignment message explains Friday → Monday shift in Calendar Week mode", () => {
  const note = describeMondayAlignment("2026-07-24", "2026-07-27");
  assert.match(note ?? "", /Calendar Week mode/);
  assert.match(note ?? "", /24\/07\/2026/);
  assert.match(note ?? "", /27\/07\/2026/);
  assert.match(note ?? "", /Monday–Sunday/);
  assert.match(note ?? "", /requested go-live/);
});
