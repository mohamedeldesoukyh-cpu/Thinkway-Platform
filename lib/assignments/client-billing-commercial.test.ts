import assert from "node:assert/strict";

import {
  computeAgencyFeeAmount,
  computeClientBilling,
} from "@/lib/assignments/client-billing-commercial";

assert.equal(computeAgencyFeeAmount(100_000, 10_000, 5), 5_500);

const billing = computeClientBilling({
  revenueBeforeVat: 100_000,
  usageRightsAmount: 10_000,
  agencyFeePercent: 5,
  vatPercent: 14,
  costBeforeVat: 80_000,
});

assert.equal(billing.agencyFeeAmount, 5_500);
assert.equal(billing.taxableBase, 115_500);
assert.equal(billing.vatAmount, 16_170);
assert.equal(billing.totalBilling, 131_670);
assert.equal(billing.gp, 35_500);

const billingWithUrCost = computeClientBilling({
  revenueBeforeVat: 100_000,
  usageRightsAmount: 10_000,
  usageRightsCost: 5_000,
  agencyFeePercent: 5,
  vatPercent: 14,
  costBeforeVat: 80_000,
});

assert.equal(billingWithUrCost.agencyFeeAmount, 5_500);
assert.equal(billingWithUrCost.taxableBase, 115_500);
assert.equal(billingWithUrCost.vatAmount, 16_170);
assert.equal(billingWithUrCost.totalBilling, 131_670);
assert.equal(billingWithUrCost.gp, 30_500);

console.log("client-billing-commercial.test.ts: ok");
