import assert from "node:assert/strict";

import {
  applyTentativeScheduleToQuotationItems,
  hasTentativeSchedule,
  mergeTentativeScheduleIntoDeliverable,
  readTentativeScheduleFromDeliverable,
} from "./quotation-tentative-schedule";
import type { QuotationDeliverable } from "./quotation-types";

const commercialDeliverable: QuotationDeliverable = {
  platform: "Instagram",
  type: "instagram_reel",
  quantity: 1,
  revenue: 50_000,
  cost: 30_000,
  cost_currency: "EGP",
  gp_pct: 40,
};

const schedule = {
  tentative_posting_label: "Week 2 · Tuesday",
  tentative_posting_date: "2026-07-14",
  planned_week: 2,
  planned_day: "Tuesday",
  schedule_source: "campaign_plan" as const,
};

const merged = mergeTentativeScheduleIntoDeliverable(commercialDeliverable, schedule);
assert.equal(merged.revenue, 50_000, "commercial revenue preserved");
assert.equal(merged.cost, 30_000, "commercial cost preserved");
assert.equal(merged.tentative_posting_label, "Week 2 · Tuesday");
assert.equal(merged.planned_week, 2);

const readBack = readTentativeScheduleFromDeliverable(merged);
assert.equal(readBack.tentative_posting_date, "2026-07-14");
assert.ok(hasTentativeSchedule(merged));
assert.equal(hasTentativeSchedule(commercialDeliverable), false);

const scheduleByCreatorKey = new Map([
  [
    "alpha",
    {
      primary: schedule,
      byPlatform: {
        instagram: schedule,
      },
    },
  ],
]);

const items = [
  {
    id: "item-1",
    unified_id: "inf:alpha",
    creator_name: "Alpha Creator",
    deliverables: [commercialDeliverable],
  },
  {
    id: "item-2",
    unified_id: "inf:unknown",
    creator_name: "Unknown Creator",
    deliverables: [{ ...commercialDeliverable, platform: "TikTok" }],
  },
];

const result = applyTentativeScheduleToQuotationItems(items, scheduleByCreatorKey);
assert.equal(result.matchedItemCount, 1);
assert.equal(result.updatedDeliverableCount, 1);
assert.equal(
  result.items[0]!.deliverables![0]!.tentative_posting_label,
  "Week 2 · Tuesday"
);
assert.equal(
  result.items[1]!.deliverables![0]!.tentative_posting_label,
  undefined,
  "unmatched item unchanged"
);

console.log("quotation-tentative-schedule.test.ts: all assertions passed");
