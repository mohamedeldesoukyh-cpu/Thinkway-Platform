import assert from "node:assert/strict";
import { test } from "node:test";
import { quotationAppliedRates } from "./quotation-applied-rates";
import { computeQuotationDisplayTotals, type QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import { makeCreatorFx } from "@/lib/commercial/creator-fx";

const row: QuotationRowDraft = { id: "aed", mode: "cost_revenue", cost: 18800, costCurrency: "AED", revenue: 26200, gpPct: 0, gpValue: 7400, afPct: 0, fxRateToEgp: 15.5 };
test("caption and total use the direct AED to USD FX pair", () => {
  assert.deepEqual(quotationAppliedRates([row], "USD", 58, { AED: 0.27229408, USD: 1 }), ["1 AED = 0.27229408 USD"]);
  assert.equal(computeQuotationDisplayTotals([row], "USD", 58, { AED: 0.27229408 }).clientCost, 7134.10);
  assert.deepEqual(quotationAppliedRates([row], "AED", 15.5), ["AED amounts unchanged"]);
});
test("agreed and historical line rates are disclosed rather than replaced by a reference rate", () => {
  const custom = { ...row, revenueFxOverride: makeCreatorFx("AED", "USD", 0.28, 58) };
  assert.deepEqual(quotationAppliedRates([custom], "USD", 58), ["1 AED = 0.28 USD"]);
  assert.deepEqual(quotationAppliedRates([row, custom], "USD", 58), ["1 AED = 0.26724138–0.28 USD (varies by line)"]);
});
test("mixed currencies, empty selections and zero-price lines have accurate captions", () => {
  const usd = { ...row, costCurrency: "USD", fxRateToEgp: 58 };
  assert.deepEqual(quotationAppliedRates([row, usd], "USD", 58), ["1 AED = 0.26724138 USD", "USD amounts unchanged"]);
  assert.deepEqual(quotationAppliedRates([], "USD", 58), []);
  assert.deepEqual(quotationAppliedRates([{ ...row, revenue: 0 }], "USD", 58), []);
});
