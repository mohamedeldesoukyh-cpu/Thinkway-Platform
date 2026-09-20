import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeQuotationRowClientCommercials,
  computeLiveQuotationTotals,
  resolveQuotationHeaderCommercialTotals,
  type QuotationRowDraft,
} from "./quotation-row-math";
import { draftToLinePending } from "@/lib/quotations/commercial-workspace/stage-pending";

const draft: QuotationRowDraft = {
  id: "aed-line", mode: "cost_revenue", cost: 1000, revenue: 1000,
  costCurrency: "AED", fxRateToEgp: 15.5, gpPct: 0, gpValue: 0, afPct: 10,
};

test("foreign-currency client price and workspace margin include agency fees once", () => {
  const result = computeQuotationRowClientCommercials(draft);
  assert.equal(result.clientCost, 1100);
  assert.equal(result.clientCostEgp, 17050);
  assert.equal(result.agencyFeeEgp, 1550);
  assert.equal(result.marginEgp, 1550);
  assert.ok(Math.abs(result.marginPct - 9.090909) < 0.00001);
  const header = resolveQuotationHeaderCommercialTotals(computeLiveQuotationTotals([draft]));
  assert.equal(result.clientCostEgp, header.totalClientCostEgp);
  assert.equal(result.marginEgp, header.headerGpValueEgp);
});

test("fee edits preserve base revenue in the save payload and update totals", () => {
  const edited = { ...draft, revenue: 1200, gpValue: 200, afPct: 15 };
  const saved = draftToLinePending(edited);
  assert.equal(saved.revenue, 1200);
  assert.equal(saved.af_pct, 15);
  const result = computeQuotationRowClientCommercials(edited);
  assert.equal(result.clientCost, 1380);
  assert.equal(result.marginEgp, 5890);
});

test("EGP and zero-fee rows do not gain duplicate fees or invalid margins", () => {
  const result = computeQuotationRowClientCommercials({ ...draft, costCurrency: "EGP", afPct: 0 });
  assert.equal(result.clientCostEgp, 1000);
  assert.equal(result.marginPct, 0);
  const empty = computeQuotationRowClientCommercials({ ...draft, cost: 0, revenue: 0 });
  assert.equal(empty.clientCostEgp, 0);
  assert.equal(empty.marginPct, 0);
});
