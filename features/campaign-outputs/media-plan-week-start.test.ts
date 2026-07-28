import assert from "node:assert/strict";
import test from "node:test";

import {
  describeMondayAlignment,
  resolveCampaignEndDate,
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

test("alignment note stays internal — no Publishing Calendar Start field name", () => {
  const note = describeMondayAlignment("2026-07-24", "2026-07-27");
  assert.match(note ?? "", /27\/07\/2026/);
  assert.match(note ?? "", /Monday–Sunday/);
  assert.doesNotMatch(note ?? "", /Publishing Calendar Start/i);
});

test("campaign end date is inclusive last day of duration window", () => {
  assert.equal(resolveCampaignEndDate("2026-07-24", 6), "2026-09-03");
  assert.equal(resolveCampaignEndDate("2026-07-27", 1), "2026-08-02");
});
