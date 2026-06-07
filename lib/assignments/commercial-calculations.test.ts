/**
 * Run: npx tsx lib/assignments/commercial-calculations.test.ts
 */
import {
  applyAssignmentTotalsToCommercialRows,
  summarizeCommercialRows,
  type CommercialDeliverableRow,
} from "@/lib/assignments/commercial-calculations";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testSingleRowSyncsAssignmentTotals() {
  const rows: CommercialDeliverableRow[] = [
    {
      id: "row-1",
      platform: "instagram",
      deliverable_type: "reel",
      quantity: 1,
      unit_cost: 1000,
      revenue_before_vat: 3000,
      live_date: null,
      notes: null,
      schedule_mode: "single",
      post_schedules: [],
    },
  ];

  const synced = applyAssignmentTotalsToCommercialRows(rows, 5000, 2500);
  const summary = summarizeCommercialRows(synced);

  assert(summary.total_revenue_before_vat === 5000, "revenue should match assignment input");
  assert(summary.total_cost_before_vat === 2500, "cost should match assignment input");
  assert(summary.gp === 2500, "gp should reflect synced totals");
}

testSingleRowSyncsAssignmentTotals();
console.log("commercial-calculations: 1 passed");
