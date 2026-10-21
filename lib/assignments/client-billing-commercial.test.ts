import assert from "node:assert/strict";

import {
  assignmentClientBilling,
  computeAgencyFeeAmount,
  computeClientBilling,
  resolveClientTaxableBase,
  rollupLineClientCommercial,
} from "@/lib/assignments/client-billing-commercial";

assert.equal(computeAgencyFeeAmount(100_000, 10_000, 5), 5_500);

// Assignment details must separate VAT from revenue and profit.
assert.deepEqual(assignmentClientBilling({ revenue_before_vat: 40000, revenue_vat_percent: 14 }), {
  subtotal: 40000, vatAmount: 5600, totalBilling: 45600,
});
const assignmentProfit = rollupLineClientCommercial({ revenueBeforeVat: 40000, costBeforeVat: 16000 });
assert.equal(assignmentProfit.gp, 24000);
assert.equal(assignmentProfit.marginPercent, 60);

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

assert.equal(
  resolveClientTaxableBase({
    revenueBeforeVat: 100_000,
    usageRightsAmount: 10_000,
    agencyFeePercent: 5,
  }),
  115_500
);

const rollup = rollupLineClientCommercial({
  revenueBeforeVat: 100_000,
  usageRightsAmount: 10_000,
  usageRightsCost: 5_000,
  agencyFeePercent: 5,
  costBeforeVat: 80_000,
});

assert.equal(rollup.billableBase, billingWithUrCost.taxableBase);
assert.equal(rollup.gp, billingWithUrCost.gp);
assert.equal(rollup.marginPercent, billingWithUrCost.marginPercent);

console.log("client-billing-commercial.test.ts: ok");
