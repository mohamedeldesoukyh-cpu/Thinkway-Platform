import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverableVatRollup } from "./deliverable-vat-rollup";

test("parent totals preserve mixed child VAT, including fees in the revenue base", () => {
  const result = deliverableVatRollup([
    { revenue_before_vat: 1000, usage_rights_amount: 100, agency_fee_amount: 110, cost_before_vat: 500, revenue_vat_amount: 169.4, cost_vat_amount: 70 },
    { revenue_before_vat: 2000, cost_before_vat: 1000, revenue_vat_amount: 0, cost_vat_amount: 0 },
  ]);
  assert.equal(result.revenue_after_vat, 3379.4);
  assert.equal(result.cost_after_vat, 1570);
  assert.equal(result.cost_vat_amount, 70);
  assert.equal(result.revenue_vat_amount, 169.4);
  assert.equal(result.cost_vat_exempt, false);
});
test("zero cost and revenue have finite zero VAT rates", () => {
  const result = deliverableVatRollup([]);
  assert.equal(result.cost_vat_percent, 0);
  assert.equal(result.revenue_vat_percent, 0);
  assert.equal(result.cost_after_vat, 0);
});
