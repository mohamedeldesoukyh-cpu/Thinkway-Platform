import assert from "node:assert/strict";

import {
  computeQuotationTotals,
  normalizeCommercialLine,
} from "@/features/quotations/quotation-engine";

// EGP line: rate forced to 1, EGP values == original
{
  const line = normalizeCommercialLine({
    mode: "cost_gp_pct",
    cost: 7500,
    costCurrency: "EGP",
    gpPct: 25,
    fxRateToEgp: 999, // ignored for EGP
  });
  assert.equal(line.fx_rate_to_egp, 1);
  assert.equal(line.revenue, 10000);
  assert.equal(line.revenue_egp, 10000);
  assert.equal(line.cost_egp, 7500);
  assert.equal(line.gp_value_egp, 2500);
  assert.equal(line.valid, true);
}

// USD line @ 50 EGP/USD
{
  const line = normalizeCommercialLine({
    mode: "cost_gp_pct",
    cost: 750,
    costCurrency: "USD",
    gpPct: 25,
    fxRateToEgp: 50,
  });
  assert.equal(line.cost, 750);
  assert.equal(line.revenue, 1000);
  assert.equal(line.cost_egp, 37500);
  assert.equal(line.revenue_egp, 50000);
  assert.equal(line.gp_value_egp, 12500);
}

// Missing rate for non-EGP falls back to identity (safe, never zeroes)
{
  const line = normalizeCommercialLine({
    mode: "cost_revenue",
    cost: 100,
    costCurrency: "USD",
    revenue: 200,
    fxRateToEgp: 0,
  });
  assert.equal(line.fx_rate_to_egp, 1);
  assert.equal(line.revenue_egp, 200);
}

// Totals aggregate in EGP with correct blended GP%
{
  const a = normalizeCommercialLine({
    mode: "cost_gp_pct",
    cost: 750,
    costCurrency: "USD",
    gpPct: 25,
    fxRateToEgp: 50,
  });
  const b = normalizeCommercialLine({
    mode: "cost_gp_value",
    cost: 6000,
    costCurrency: "EGP",
    gpValue: 4000,
    fxRateToEgp: 1,
  });
  const totals = computeQuotationTotals([a, b]);
  // a: cost 37500, rev 50000, gp 12500 | b: cost 6000, rev 10000, gp 4000
  assert.equal(totals.totalCostEgp, 43500);
  assert.equal(totals.totalRevenueEgp, 60000);
  assert.equal(totals.totalGpValueEgp, 16500);
  // blended GP% = 16500/60000*100 = 27.5
  assert.equal(totals.totalGpPct, 27.5);
  assert.equal(totals.lineCount, 2);
}

console.log("quotation-engine.test.ts: all assertions passed");
