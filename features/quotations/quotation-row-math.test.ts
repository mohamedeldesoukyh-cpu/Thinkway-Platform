import assert from "node:assert/strict";

import { computeCommercials } from "@/lib/commercial/commercial-engine";
import {
  computeLiveQuotationTotals,
  computeQuotationRowComputed,
  draftFromQuotationItem,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";

function mockItem(overrides: Partial<QuotationItemRow> = {}): QuotationItemRow {
  return {
    id: overrides.id ?? "item-1",
    influencer_id: null,
    profile_id: null,
    unified_id: null,
    source_shortlist_item_id: null,
    creator_name: "Creator",
    platform: "instagram",
    handle: "@creator",
    followers: 10000,
    engagement_rate: 3,
    country_code: "EG",
    deliverables: [],
    commercial_input_mode: "cost_markup_pct",
    cost: 1000,
    cost_currency: "EGP",
    revenue: 1250,
    gp_pct: 25,
    gp_value: 250,
    fx_rate_to_egp: 1,
    cost_egp: 1000,
    revenue_egp: 1250,
    gp_value_egp: 250,
    sort_order: 0,
    ...overrides,
  };
}

// Markup mode: Revenue = Cost × (1 + Markup%)
{
  const r = computeCommercials({ mode: "cost_markup_pct", cost: 1000, gpPct: 25 });
  assert.equal(r.valid, true);
  assert.equal(r.revenue, 1250);
  assert.equal(r.gpValue, 250);
  assert.equal(r.gpPct, 20); // margin on revenue = 250/1250
}

// Single creator — live totals match row EGP
{
  const item = mockItem();
  const draft = draftFromQuotationItem(item);
  const row = computeQuotationRowComputed(draft);
  const totals = computeLiveQuotationTotals([draft]);
  assert.equal(row.costEgp, 1000);
  assert.equal(row.revenueEgp, 1250);
  assert.equal(totals.totalCostEgp, 1000);
  assert.equal(totals.totalRevenueEgp, 1250);
  assert.equal(totals.totalGpValueEgp, 250);
  assert.equal(totals.totalGpPct, 20);
}

// Multiple creators — header equals sum of row cost/revenue EGP
{
  const a: QuotationRowDraft = {
    id: "a",
    mode: "cost_gp_pct",
    cost: 750,
    costCurrency: "USD",
    gpPct: 25,
    revenue: 0,
    gpValue: 0,
    fxRateToEgp: 50,
  };
  const b: QuotationRowDraft = {
    id: "b",
    mode: "cost_gp_value",
    cost: 6000,
    costCurrency: "EGP",
    gpPct: 0,
    revenue: 0,
    gpValue: 4000,
    fxRateToEgp: 1,
  };
  const rowA = computeQuotationRowComputed(a);
  const rowB = computeQuotationRowComputed(b);
  const totals = computeLiveQuotationTotals([a, b]);
  assert.equal(totals.totalCostEgp, rowA.costEgp + rowB.costEgp);
  assert.equal(totals.totalRevenueEgp, rowA.revenueEgp + rowB.revenueEgp);
  assert.equal(totals.totalGpValueEgp, totals.totalRevenueEgp - totals.totalCostEgp);
  assert.equal(totals.totalCostEgp, 43500);
  assert.equal(totals.totalRevenueEgp, 60000);
  assert.equal(totals.totalGpValueEgp, 16500);
  assert.equal(totals.totalGpPct, 27.5);
}

// Mixed currencies with live edit (USD rate snapshotted)
{
  const draft: QuotationRowDraft = {
    id: "usd",
    mode: "cost_markup_pct",
    cost: 500,
    costCurrency: "USD",
    gpPct: 20,
    revenue: 0,
    gpValue: 0,
    fxRateToEgp: 48.5,
  };
  const row = computeQuotationRowComputed(draft);
  assert.equal(row.costEgp, 24250);
  assert.equal(row.revenueEgp, 29100); // 600 USD × 48.5
  const totals = computeLiveQuotationTotals([draft]);
  assert.equal(totals.totalGpValueEgp, totals.totalRevenueEgp - totals.totalCostEgp);
}

// Creator removal — totals exclude removed draft
{
  const drafts = [
    draftFromQuotationItem(mockItem({ id: "keep", cost: 1000, gp_pct: 25, revenue: 1250, gp_value: 250 })),
    draftFromQuotationItem(
      mockItem({ id: "drop", cost: 500, gp_pct: 25, revenue: 625, gp_value: 125, cost_egp: 500, revenue_egp: 625, gp_value_egp: 125 })
    ),
  ];
  const all = computeLiveQuotationTotals(drafts);
  const afterRemove = computeLiveQuotationTotals(drafts.filter((d) => d.id !== "drop"));
  assert.equal(all.totalCostEgp, 1500);
  assert.equal(afterRemove.totalCostEgp, 1000);
  assert.equal(afterRemove.totalRevenueEgp, 1250);
}

// Manual revenue entry (cost_revenue mode)
{
  const draft: QuotationRowDraft = {
    id: "manual",
    mode: "cost_revenue",
    cost: 800,
    costCurrency: "EGP",
    gpPct: 0,
    revenue: 1200,
    gpValue: 0,
    fxRateToEgp: 1,
  };
  const row = computeQuotationRowComputed(draft);
  assert.equal(row.revenueEgp, 1200);
  assert.equal(row.gpValueEgp, 400);
  assert.equal(row.gpPct, 33.3333);
  const totals = computeLiveQuotationTotals([draft]);
  assert.equal(totals.totalGpValueEgp, 400);
}

// Autosave refresh simulation — draft picks up server FX rate after currency save
{
  const before: QuotationRowDraft = {
    id: "fx",
    mode: "cost_gp_pct",
    cost: 100,
    costCurrency: "USD",
    gpPct: 25,
    revenue: 0,
    gpValue: 0,
    fxRateToEgp: 1, // optimistic until server responds
  };
  const optimistic = computeQuotationRowComputed(before);
  assert.equal(optimistic.costEgp, 100);

  const afterSave: QuotationRowDraft = { ...before, fxRateToEgp: 50 };
  const refreshed = computeQuotationRowComputed(afterSave);
  assert.equal(refreshed.costEgp, 5000);
  assert.equal(refreshed.revenueEgp, 6666.5);
  const totals = computeLiveQuotationTotals([afterSave]);
  assert.equal(totals.totalCostEgp, refreshed.costEgp);
}

console.log("quotation-row-math.test.ts: all assertions passed");
