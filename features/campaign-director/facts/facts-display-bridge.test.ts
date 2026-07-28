import assert from "node:assert/strict";
import test from "node:test";

import { applyFactsToSummaryData } from "./facts-display-bridge";
import type { CampaignFacts } from "./campaign-facts-types";

test("applyFactsToSummaryData binds campaign start, end, and duration only", () => {
  const facts: CampaignFacts = {
    brandName: "Acme",
    durationWeeks: 6,
    requestedStartDate: "2026-07-24",
    campaignStartDate: "2026-07-24",
    scheduledStartDate: "2026-07-27",
  };

  const cards = applyFactsToSummaryData(
    {
      publishingCalendarStart: "stale",
      calendarAlignmentNote: "stale",
    } as never,
    facts
  );
  assert.equal(cards.campaignStartDate, "24/07/2026");
  assert.equal(cards.campaignEndDate, "03/09/2026"); // 24/07 + 6×7 − 1
  assert.equal(cards.duration, "6 weeks");
  assert.equal(
    (cards as { publishingCalendarStart?: string }).publishingCalendarStart,
    undefined
  );
  assert.equal(
    (cards as { calendarAlignmentNote?: string }).calendarAlignmentNote,
    undefined
  );
});

test("applyFactsToSummaryData clears start/end when facts have no start", () => {
  const cards = applyFactsToSummaryData(
    { campaignStartDate: "01/01/2026", campaignEndDate: "01/02/2026" },
    { durationWeeks: 4 }
  );
  assert.equal(cards.campaignStartDate, undefined);
  assert.equal(cards.campaignEndDate, undefined);
  assert.equal(cards.duration, "4 weeks");
});

test("applyFactsToSummaryData prefers explicit campaignEndDate over duration-derived end", () => {
  const cards = applyFactsToSummaryData(
    {},
    {
      durationWeeks: 6,
      requestedStartDate: "2026-07-24",
      campaignStartDate: "2026-07-24",
      campaignEndDate: "2026-08-23",
    }
  );
  assert.equal(cards.campaignStartDate, "24/07/2026");
  assert.equal(cards.campaignEndDate, "23/08/2026");
});
