import assert from "node:assert/strict";

import { computeQuotationTotals } from "@/lib/commercial/quotation-engine";
import { stripQuotationVersionSuffix } from "@/lib/commercial-sync/rules";
import { DEFAULT_QUOTATION_LINE_COMMERCIAL_MODE } from "@/lib/domains/commercial/quotation-constants";

import type { QuotationItemSeed } from "@/lib/domains/commercial/quotation-types";

async function main() {
  const totals = computeQuotationTotals([
    { cost_egp: 1000, revenue_egp: 1500, gp_value_egp: 500, af_value_egp: 75 },
    { cost_egp: 2000, revenue_egp: 2500, gp_value_egp: 500, af_value_egp: 125 },
  ]);
  assert.equal(totals.totalCostEgp, 3000);
  assert.equal(totals.totalRevenueEgp, 4000);
  assert.ok(totals.totalGpPct > 0);

  assert.equal(stripQuotationVersionSuffix("TW-Q-2026-0001-V2"), "TW-Q-2026-0001");
  assert.equal(stripQuotationVersionSuffix(null), "");

  const seed: QuotationItemSeed = {
    creator_name: "Test",
    cost_currency: "EGP",
  };
  assert.equal(seed.cost_currency, "EGP");
  assert.equal(DEFAULT_QUOTATION_LINE_COMMERCIAL_MODE, "cost_gp_pct");
  assert.equal(seed.commercial_input_mode ?? DEFAULT_QUOTATION_LINE_COMMERCIAL_MODE, "cost_gp_pct");

  console.log("quotation-service-layer.test.ts: all assertions passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
