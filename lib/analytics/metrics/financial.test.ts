import assert from "node:assert/strict";

import {
  metricsFromCampaignLines,
  resolveLineCommercialMetrics,
} from "@/lib/analytics/metrics/financial";

const shimaaLine = {
  revenue: 150_000,
  cost: 140_000,
  profit: 10_000,
  billing_status: "approved" as const,
  revenue_before_vat: 150_000,
  usage_rights_amount: 0,
  usage_rights_cost: 0,
  agency_fee_percent: 10,
  agency_fee_amount: 15_000,
  cost_before_vat: 140_000,
};

const billable = resolveLineCommercialMetrics(shimaaLine);
assert.equal(billable.revenue, 165_000, "Rev + AF billable base");
assert.equal(billable.gp, 25_000, "GP = billable − cost");

const metrics = metricsFromCampaignLines([shimaaLine], 0);
assert.equal(metrics.revenue, 165_000, "dashboard revenue uses billable base");
assert.equal(metrics.gp, 25_000, "dashboard GP uses commercial rollup");
assert.equal(metrics.margin_percent, 15.15, "margin on billable base");

console.log("financial.test.ts: all assertions passed");
