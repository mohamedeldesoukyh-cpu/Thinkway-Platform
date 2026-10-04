import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateCampaignDisplayFinancials } from "./campaign-display-financials";
import { makeCreatorFx } from "@/lib/commercial/creator-fx";

const calculate = (costRate: number, revenueRate: number, system = 60) => aggregateCampaignDisplayFinancials({
  displayCurrency: "EGP", rateToEgpByCurrency: new Map([["USD", system]]),
  lines: [{ currency_code: "USD", cost: 800, revenue: 1000, cost_fx_override: makeCreatorFx("USD", "EGP", costRate, 1), revenue_fx_override: makeCreatorFx("USD", "EGP", revenueRate, 1) }],
});
test("requested example separates EGP 10000 GP from EGP 1600 FX gain", () => {
  const f = calculate(48, 50);
  assert.equal(f.gp, 10000); assert.equal(f.fx_gain_loss, 1600);
  assert.equal(f.gp + f.fx_gain_loss, f.revenue - f.cost);
});
test("loss is negative; equal rates have no FX component", () => {
  assert.equal(calculate(52, 50).fx_gain_loss, -1600);
  assert.equal(calculate(50, 50).fx_gain_loss, 0);
  assert.equal(calculate(52, 50).gp, 10000);
});
test("custom conversions and GP/FX split survive changed master exchange rates", () => {
  assert.deepEqual(calculate(48, 50, 60), calculate(48, 50, 75));
});
test("usage rights cost is included in FX and agency fee is included in GP, excluding VAT", () => {
  const f = aggregateCampaignDisplayFinancials({ displayCurrency: "EGP", rateToEgpByCurrency: new Map([["USD", 60]]),
    lines: [{ currency_code: "USD", cost: 800, revenue: 1000, usage_rights_cost: 100, usage_rights_amount: 200, agency_fee_percent: 10,
      cost_fx_override: makeCreatorFx("USD", "EGP", 48, 1), revenue_fx_override: makeCreatorFx("USD", "EGP", 50, 1) }] });
  assert.equal(f.revenue, 66000); assert.equal(f.gp, 21000); assert.equal(f.fx_gain_loss, 1800);
  assert.equal(f.gp + f.fx_gain_loss, f.revenue - f.cost - 4800);
});
test("frozen mixed-currency cross rate keeps the baseline stable", () => {
  const run = (usd: number, aed: number) => aggregateCampaignDisplayFinancials({ displayCurrency: "EGP", rateToEgpByCurrency: new Map([["USD", usd], ["AED", aed]]),
    lines: [{ currency_code: "USD", revenue: 1000, cost_received: 3000, cost_received_currency: "AED", fx_cost_revenue_cross_rate: 0.25,
      cost_fx_override: makeCreatorFx("AED", "EGP", 12, 1), revenue_fx_override: makeCreatorFx("USD", "EGP", 50, 1) }] });
  const f = run(60, 15);
  assert.equal(f.gp, 12500); assert.equal(f.fx_gain_loss, 1500);
  assert.deepEqual(f, run(80, 24));
});
test("without overrides mixed native currencies produce no spurious FX gain", () => {
  const f = aggregateCampaignDisplayFinancials({ displayCurrency: "EGP", rateToEgpByCurrency: new Map([["USD", 50], ["AED", 12.5]]),
    lines: [{ currency_code: "USD", revenue: 1000, cost_received: 3000, cost_received_currency: "AED" }] });
  assert.equal(f.fx_gain_loss, 0); assert.equal(f.gp, 12500);
});
