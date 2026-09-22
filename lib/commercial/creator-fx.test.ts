import assert from "node:assert/strict";
import { test } from "node:test";
import { creatorFxAmount, creatorFxRate, makeCreatorFx, readCreatorFx } from "./creator-fx";
import { computeQuotationDisplayTotals, computeQuotationRowComputed, type QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import { draftToLinePending } from "@/lib/quotations/commercial-workspace/stage-pending";
import { diffMasterChanges, allocateMasterAcrossAssignments } from "@/lib/services/commercial/field-registry";
import { aggregateCampaignDisplayFinancials } from "@/lib/campaigns/campaign-display-financials";
import { projectBillingRows } from "@/lib/billing/billing-currency";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

const draft: QuotationRowDraft = { id: "creator", mode: "cost_revenue", cost: 1000, revenue: 1500, costCurrency: "USD", gpPct: 0, gpValue: 500, afPct: 10, fxRateToEgp: 50 };
const conversion = { from: "USD", to: "EGP", sourceRateToEgp: 50, targetRateToEgp: 1 };

test("new creators use the system rate until a side is overridden", () => {
  assert.equal(creatorFxAmount(1000, conversion), 50000);
  assert.equal(creatorFxAmount(1000, { ...conversion, sourceRateToEgp: 55 }), 55000);
  const override = makeCreatorFx("USD", "EGP", 52, 1);
  assert.equal(creatorFxAmount(1000, { ...conversion, sourceRateToEgp: 55, override }), 52000);
  assert.equal(creatorFxAmount(1000, { ...conversion, sourceRateToEgp: 55, override: null }), 55000);
});

test("header currency changes display without changing the negotiated pair", () => {
  const override = makeCreatorFx("AED", "USD", 0.28, 50);
  assert.equal(creatorFxAmount(1000, { from: "AED", to: "USD", sourceRateToEgp: 20, targetRateToEgp: 60, override }), 280);
  assert.equal(creatorFxAmount(1000, { from: "AED", to: "EGP", sourceRateToEgp: 20, targetRateToEgp: 1, override }), 14000);
  assert.equal(creatorFxAmount(1000, { from: "AED", to: "AED", sourceRateToEgp: 20, targetRateToEgp: 20, override }), 1000);
  // EGP original amounts can also have a negotiated foreign-currency conversion.
  assert.equal(creatorFxAmount(1000, { from: "EGP", to: "USD", sourceRateToEgp: 1, targetRateToEgp: 55, override: makeCreatorFx("EGP", "USD", 0.025, 50) }), 25);
});

test("editing a converted amount derives a precise rate without changing original amounts", () => {
  const override = makeCreatorFx("USD", "EGP", 52550.75 / draft.cost, 1);
  assert.equal(readCreatorFx(override)?.rate, 52.55075);
  assert.equal(creatorFxAmount(draft.cost, { ...conversion, override }), 52550.75);
  assert.equal(draft.cost, 1000);
});

test("cost and revenue overrides independently recalculate GP and agency fee", () => {
  const row = { ...draft, costFxOverride: makeCreatorFx("USD", "EGP", 52, 1), revenueFxOverride: makeCreatorFx("USD", "EGP", 54, 1) };
  const calculated = computeQuotationRowComputed(row);
  assert.equal(calculated.costEgp, 52000);
  assert.equal(calculated.revenueEgp, 81000);
  assert.equal(calculated.gpValueEgp, 29000);
  assert.equal(calculated.afValueEgp, 8100);
  assert.equal(calculated.agencyMarginEgp, 37100);
  assert.equal(draftToLinePending(row).cost_fx_override, row.costFxOverride);
});

test("custom pairs are commercial revision masters and copy intact to each assignment", () => {
  const custom = makeCreatorFx("USD", "EGP", 52, 1);
  assert.equal(diffMasterChanges({ cost_fx_override: null }, { cost_fx_override: custom }).fieldChanges.length, 1);
  const shares = allocateMasterAcrossAssignments({ creator_cost: 1000, cost_fx_override: custom }, 2);
  assert.equal(shares[0].creator_cost, 500);
  assert.equal(shares[1].cost_fx_override, custom);
});

test("campaign totals use separate pairs including the exact negotiated header currency", () => {
  const result = aggregateCampaignDisplayFinancials({ lines: [{ cost: 1000, revenue: 1500, currency_code: "AED", cost_fx_override: makeCreatorFx("AED", "USD", 0.28, 50), revenue_fx_override: makeCreatorFx("AED", "USD", 0.3, 50) }], displayCurrency: "USD", rateToEgpByCurrency: new Map([["AED", 20], ["USD", 60]]) });
  assert.equal(result.cost, 280);
  assert.equal(result.revenue, 450);
  assert.equal(result.gp, 170);
});

test("billing descendants inherit the negotiated revenue rate", () => {
  const child = { id: "child", billable_amount: 100, children: [] } as unknown as OperationalBillingRow;
  const row = { id: "parent", currency_code: "USD", revenue_fx_override: makeCreatorFx("USD", "EGP", 52, 1), billable_amount: 100, children: [child] } as unknown as OperationalBillingRow;
  const [projected] = projectBillingRows([row], "EGP", { USD: 60, EGP: 1 });
  assert.equal(projected.billable_amount, 5200);
  assert.equal(projected.children[0].billable_amount, 5200);
});

test("invalid rates and mismatched original currencies cannot silently apply", () => {
  for (const rate of [0, -1, Infinity, NaN, 1e10]) assert.throws(() => makeCreatorFx("USD", "EGP", rate, 1));
  assert.equal(readCreatorFx("invalid"), null);
  assert.equal(creatorFxRate({ ...conversion, override: makeCreatorFx("AED", "EGP", 14, 1) }), 50);
});


test("quotation header totals retain exact pairs after system rates change", () => {
  const row = { ...draft, costCurrency: "AED", costFxOverride: makeCreatorFx("AED", "USD", 0.28, 50), revenueFxOverride: makeCreatorFx("AED", "USD", 0.3, 50) };
  const totals = computeQuotationDisplayTotals([row], "USD", 60);
  assert.equal(totals.cost, 280);
  assert.equal(totals.revenue, 450);
  assert.equal(totals.af, 45);
  assert.equal(totals.clientCost, 495);
  assert.throws(() => creatorFxRate({ from: "AED", to: "EUR", sourceRateToEgp: 20, targetRateToEgp: 0, override: row.costFxOverride }), /Missing FX/);
});
