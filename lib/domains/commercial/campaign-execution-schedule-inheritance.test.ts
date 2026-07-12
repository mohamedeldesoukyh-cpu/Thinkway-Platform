import assert from "node:assert/strict";

import {
  buildScheduleHintsFromQuotationDeliverables,
  resolveHintForDeliverable,
  resolveOperationalLiveDate,
} from "./campaign-execution-schedule-inheritance";

const hints = buildScheduleHintsFromQuotationDeliverables([
  {
    platform: "instagram",
    type: "instagram_reel",
    type_lines: [{ type: "instagram_reel", quantity: 1 }],
    quantity: 1,
    tentative_posting_date: "2026-08-01",
    tentative_posting_label: "Week 2 · Tuesday",
    schedule_source: "campaign_plan",
  },
]);

assert.equal(hints.length, 1);
assert.equal(hints[0]?.deliverableType, "instagram_reel");

const used = new Set<number>();
const matched = resolveHintForDeliverable(
  hints,
  "instagram",
  "instagram_reel",
  used
);
assert.ok(matched);
assert.equal(resolveOperationalLiveDate(matched, null), "2026-08-01");

console.log("campaign-execution-schedule-inheritance.test.ts — all tests passed");
