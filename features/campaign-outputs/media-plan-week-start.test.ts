import assert from "node:assert/strict";
import test from "node:test";

import {
  describePublishingCalendarAlignment,
  endOfPublishingWeek,
  resolveCampaignEndDate,
  resolvePublishingCalendarRange,
  resolveScheduledStartDate,
  startOfPublishingWeek,
  toIsoCampaignDate,
} from "./media-plan-week-start";

test("Wednesday 15 Jul 2026 opens publishing week on Saturday 11 Jul 2026", () => {
  assert.equal(resolveScheduledStartDate("2026-07-15"), "2026-07-11");
  const wed = new Date(2026, 6, 15, 12, 0, 0, 0);
  assert.equal(toIsoCampaignDate(startOfPublishingWeek(wed)), "2026-07-11");
  assert.equal(toIsoCampaignDate(endOfPublishingWeek(wed)), "2026-07-17");
});

test("Saturday start is unchanged", () => {
  assert.equal(resolveScheduledStartDate("2026-07-11"), "2026-07-11");
});

test("Friday belongs to the week that started the prior Saturday", () => {
  assert.equal(resolveScheduledStartDate("2026-07-24"), "2026-07-18");
  assert.equal(toIsoCampaignDate(endOfPublishingWeek(new Date(2026, 6, 24, 12))), "2026-07-24");
});

test("example: 15 Jul – 14 Aug 2026 yields five Saturday–Friday weeks", () => {
  const range = resolvePublishingCalendarRange("2026-07-15", "2026-08-14");
  assert.ok(range);
  assert.equal(range!.gridStartIso, "2026-07-11");
  assert.equal(range!.gridEndIso, "2026-08-14");
  assert.equal(range!.weeks.length, 5);
  assert.deepEqual(
    range!.weeks.map((w) => `${w.startIso}..${w.endIso}`),
    [
      "2026-07-11..2026-07-17",
      "2026-07-18..2026-07-24",
      "2026-07-25..2026-07-31",
      "2026-08-01..2026-08-07",
      "2026-08-08..2026-08-14",
    ]
  );
});

test("alignment message mentions Saturday–Friday weeks", () => {
  assert.equal(describePublishingCalendarAlignment("2026-07-11", "2026-07-11"), null);
  const note = describePublishingCalendarAlignment("2026-07-15", "2026-07-11");
  assert.match(note ?? "", /11\/07\/2026/);
  assert.match(note ?? "", /Saturday–Friday/);
  assert.doesNotMatch(note ?? "", /Monday–Sunday/);
});

test("campaign end date is inclusive last day of duration window", () => {
  assert.equal(resolveCampaignEndDate("2026-07-15", 1), "2026-07-21");
  assert.equal(resolveCampaignEndDate("2026-07-24", 6), "2026-09-03");
});
