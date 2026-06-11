/**
 * Run: npx tsx lib/assignments/commercial-calculations.test.ts
 */
import {
  applyAssignmentTotalsToCommercialRows,
  applyAssignmentUrAfToCommercialRows,
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

function testUrAfDistributesByRevenueShare() {
  const rows: CommercialDeliverableRow[] = [
    {
      id: "row-1",
      platform: "instagram",
      deliverable_type: "reel",
      quantity: 1,
      unit_cost: 500,
      revenue_before_vat: 3000,
      usage_rights_amount: 0,
      agency_fee_percent: 0,
      live_date: null,
      notes: null,
      schedule_mode: "single",
      post_schedules: [],
    },
    {
      id: "row-2",
      platform: "tiktok",
      deliverable_type: "video",
      quantity: 1,
      unit_cost: 500,
      revenue_before_vat: 2000,
      usage_rights_amount: 0,
      agency_fee_percent: 0,
      live_date: null,
      notes: null,
      schedule_mode: "single",
      post_schedules: [],
    },
  ];

  const synced = applyAssignmentUrAfToCommercialRows(rows, 1000, 10);
  const urTotal = synced.reduce((sum, row) => sum + (row.usage_rights_amount ?? 0), 0);

  assert(Math.abs(urTotal - 1000) < 0.02, "UR should sum to assignment target");
  assert(synced[0]!.usage_rights_amount === 600, "UR should scale 60/40 by revenue");
  assert(synced[1]!.usage_rights_amount === 400, "UR should scale 60/40 by revenue");
  assert(synced.every((row) => row.agency_fee_percent === 10), "AF% should match assignment");
}

function testSingleRowUrAfSync() {
  const rows: CommercialDeliverableRow[] = [
    {
      id: "row-1",
      platform: "instagram",
      deliverable_type: "reel",
      quantity: 2,
      unit_cost: 1000,
      revenue_before_vat: 3000,
      usage_rights_amount: 0,
      agency_fee_percent: 0,
      live_date: null,
      notes: null,
      schedule_mode: "single",
      post_schedules: [],
    },
  ];

  const synced = applyAssignmentUrAfToCommercialRows(rows, 500, 15);
  assert(synced[0]!.usage_rights_amount === 500, "single row UR should match target");
  assert(synced[0]!.agency_fee_percent === 15, "single row AF% should match target");
}

testUrAfDistributesByRevenueShare();
testSingleRowUrAfSync();
console.log("commercial-calculations: 3 passed");
