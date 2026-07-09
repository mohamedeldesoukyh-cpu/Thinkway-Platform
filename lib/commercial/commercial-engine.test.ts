import assert from "node:assert/strict";

import {
  computeAgencyFee,
  computeCommercials,
  MAX_GP_PCT,
} from "@/lib/commercial/commercial-engine";
import {
  aggregateEgpTotals,
  COMMERCIAL_CURRENCIES,
  formatDualCurrency,
  isCommercialCurrency,
  toEgp,
} from "@/lib/commercial/fx-aggregation";

// ---------------------------------------------------------------------------
// Mode A2: cost + markup% → revenue, GP value
// ---------------------------------------------------------------------------
{
  const r = computeCommercials({ mode: "cost_markup_pct", cost: 1000, gpPct: 25 });
  assert.equal(r.valid, true);
  assert.equal(r.revenue, 1250);
  assert.equal(r.gpValue, 250);
  // Margin on revenue = 250/1250 = 20%
  assert.equal(r.gpPct, 20);
}

// ---------------------------------------------------------------------------
// Mode A: cost + GP% → revenue, GP value
// ---------------------------------------------------------------------------
{
  const r = computeCommercials({ mode: "cost_gp_pct", cost: 750, gpPct: 25 });
  assert.equal(r.valid, true);
  assert.equal(r.cost, 750);
  // Revenue = 750 / (1 - 0.25) = 1000
  assert.equal(r.revenue, 1000);
  assert.equal(r.gpValue, 250);
  assert.equal(r.gpPct, 25);
}

// Mode A: 0% GP → revenue equals cost
{
  const r = computeCommercials({ mode: "cost_gp_pct", cost: 500, gpPct: 0 });
  assert.equal(r.revenue, 500);
  assert.equal(r.gpValue, 0);
}

// Mode A: GP% >= 100 rejected
{
  const r = computeCommercials({ mode: "cost_gp_pct", cost: 500, gpPct: 100 });
  assert.equal(r.valid, false);
  assert.match(r.warning ?? "", /below 100/);
}
{
  const r = computeCommercials({ mode: "cost_gp_pct", cost: 500, gpPct: 150 });
  assert.equal(r.valid, false);
}

// Mode A: negative GP% rejected
{
  const r = computeCommercials({ mode: "cost_gp_pct", cost: 500, gpPct: -5 });
  assert.equal(r.valid, false);
  assert.match(r.warning ?? "", /negative/);
}

// Mode A: zero cost → zero revenue
{
  const r = computeCommercials({ mode: "cost_gp_pct", cost: 0, gpPct: 40 });
  assert.equal(r.revenue, 0);
  assert.equal(r.gpValue, 0);
}

// ---------------------------------------------------------------------------
// Mode B: cost + revenue → GP%, GP value
// ---------------------------------------------------------------------------
{
  const r = computeCommercials({ mode: "cost_revenue", cost: 750, revenue: 1000 });
  assert.equal(r.valid, true);
  assert.equal(r.gpValue, 250);
  assert.equal(r.gpPct, 25);
}

// Mode B: revenue 0 → GP% 0 (no divide-by-zero)
{
  const r = computeCommercials({ mode: "cost_revenue", cost: 0, revenue: 0 });
  assert.equal(r.gpPct, 0);
  assert.equal(r.gpValue, 0);
  assert.equal(r.valid, true);
}

// Mode B: revenue below cost → negative GP warning
{
  const r = computeCommercials({ mode: "cost_revenue", cost: 1000, revenue: 800 });
  assert.equal(r.gpValue, -200);
  assert.match(r.warning ?? "", /below cost/);
}

// Mode B: negative revenue rejected
{
  const r = computeCommercials({ mode: "cost_revenue", cost: 100, revenue: -50 });
  assert.equal(r.valid, false);
}

// ---------------------------------------------------------------------------
// Mode C: cost + GP value → revenue, GP%
// ---------------------------------------------------------------------------
{
  const r = computeCommercials({ mode: "cost_gp_value", cost: 750, gpValue: 250 });
  assert.equal(r.valid, true);
  assert.equal(r.revenue, 1000);
  assert.equal(r.gpPct, 25);
}

// Mode C: negative GP value → warning, revenue below cost
{
  const r = computeCommercials({ mode: "cost_gp_value", cost: 1000, gpValue: -200 });
  assert.equal(r.revenue, 800);
  assert.match(r.warning ?? "", /negative/);
}

// Round-trip consistency: A → B → C all reconcile
{
  const a = computeCommercials({ mode: "cost_gp_pct", cost: 600, gpPct: 40 });
  const b = computeCommercials({ mode: "cost_revenue", cost: 600, revenue: a.revenue });
  const c = computeCommercials({ mode: "cost_gp_value", cost: 600, gpValue: a.gpValue });
  assert.equal(a.revenue, b.revenue);
  assert.equal(a.gpPct, b.gpPct);
  assert.equal(a.revenue, c.revenue);
  assert.equal(a.gpPct, c.gpPct);
}

// Negative cost guard
{
  const r = computeCommercials({ mode: "cost_gp_pct", cost: -10, gpPct: 20 });
  assert.equal(r.valid, false);
}

// Rounding: irrational revenue rounds to 2dp
{
  const r = computeCommercials({ mode: "cost_gp_pct", cost: 100, gpPct: 33 });
  // 100 / 0.67 = 149.2537... → 149.25
  assert.equal(r.revenue, 149.25);
}

assert.equal(MAX_GP_PCT, 100);

// ---------------------------------------------------------------------------
// FX conversion + EGP aggregation
// ---------------------------------------------------------------------------
assert.deepEqual([...COMMERCIAL_CURRENCIES], ["EGP", "USD", "AED", "SAR", "EUR", "GBP"]);
assert.equal(isCommercialCurrency("USD"), true);
assert.equal(isCommercialCurrency("JPY"), false);

// 500 USD @ 50 EGP/USD → 25,000 EGP
assert.equal(toEgp(500, 50), 25000);
// Missing/zero rate falls back to identity (never zeroes data)
assert.equal(toEgp(500, 0), 500);
assert.equal(toEgp(500, null), 500);

assert.equal(formatDualCurrency({ amount: 500, currency: "USD", egpAmount: 25000 }), "500 USD / 25,000 EGP");
assert.equal(formatDualCurrency({ amount: 1000, currency: "EGP", egpAmount: 1000 }), "1,000 EGP");

// Agency fee from client cost (revenue)
{
  const af = computeAgencyFee({ revenue: 10000, afPct: 10, gpValue: 2500 });
  assert.equal(af.afValue, 1000);
  assert.equal(af.agencyMargin, 3500);
}

// Blended totals across mixed currencies (already converted to EGP)
{
  const totals = aggregateEgpTotals([
    { costEgp: 25000, revenueEgp: 33333.33, gpValueEgp: 8333.33, afValueEgp: 3333.33 },
    { costEgp: 6000, revenueEgp: 10000, gpValueEgp: 4000, afValueEgp: 1000 },
  ]);
  assert.equal(totals.lineCount, 2);
  assert.equal(totals.totalCostEgp, 31000);
  assert.equal(totals.totalRevenueEgp, 43333.33);
  assert.equal(totals.totalGpValueEgp, 12333.33);
  assert.equal(totals.totalAfValueEgp, 4333.33);
  assert.equal(totals.totalAgencyMarginEgp, 16666.66);
  // Blended GP% = 12333.33 / 43333.33 * 100 ≈ 28.4615
  assert.ok(Math.abs(totals.totalGpPct - 28.4615) < 0.01);
  // Blended PM% = 12333.33 / 31000 * 100 ≈ 39.7849
  assert.ok(Math.abs(totals.totalPmPct - 39.7849) < 0.01);
}

// Empty aggregation → zeros, no divide-by-zero
{
  const totals = aggregateEgpTotals([]);
  assert.equal(totals.totalRevenueEgp, 0);
  assert.equal(totals.totalGpPct, 0);
  assert.equal(totals.totalPmPct, 0);
  assert.equal(totals.totalAfValueEgp, 0);
  assert.equal(totals.totalAgencyMarginEgp, 0);
  assert.equal(totals.lineCount, 0);
}

console.log("commercial-engine.test.ts: all assertions passed");
