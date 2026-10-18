import assert from "node:assert/strict";
import { quotationListClientCost, quotationListStatusTotals } from "./quotation-list-commercial";
assert.equal(quotationListClientCost({ total_revenue_egp: 2230000, total_af_egp: 223000 }), 2453000);
assert.equal(quotationListClientCost({ total_revenue_egp: 100, total_af_egp: 0 }), 100);
assert.equal(quotationListClientCost({ total_revenue_egp: 0, total_af_egp: 0 }), 0);
assert.equal(quotationListClientCost({ total_revenue_egp: 100 }), 100);
assert.equal(quotationListClientCost({ total_revenue_egp: 0.1, total_af_egp: 0.2 }), 0.3);
// Stored EGP amounts must not be converted twice for foreign currency quotations.
assert.equal(quotationListClientCost({ total_revenue_egp: 50000, total_af_egp: 7500 }), 57500);
console.log("Quotation list client cost tests passed.");

const totals = quotationListStatusTotals([
  { status: "approved", total_revenue_egp: 100, total_af_egp: 10, total_cost_egp: 60 },
  { status: "under_review", total_revenue_egp: 200, total_af_egp: 20, total_cost_egp: 150 },
  { status: "draft", total_revenue_egp: 300, total_af_egp: 30, total_cost_egp: 250 },
  { status: "rejected", total_revenue_egp: 999, total_af_egp: 0, total_cost_egp: 999 },
  { status: "cancelled", total_revenue_egp: 999, total_af_egp: 0, total_cost_egp: 999 },
]);
assert.deepEqual(totals.approved, { count: 1, revenue: 110, cost: 60 });
assert.deepEqual(totals.under_review, { count: 1, revenue: 220, cost: 150 });
assert.deepEqual(totals.draft, { count: 1, revenue: 330, cost: 250 });
assert.deepEqual(quotationListStatusTotals([]).approved, { count: 0, revenue: 0, cost: 0 });
console.log("Quotation status totals tests passed.");
