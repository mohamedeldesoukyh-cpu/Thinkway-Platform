import assert from "node:assert/strict";

import {
  computeClientInvoiceVatPreview,
  resolveClientBillableAmount,
} from "@/lib/billing/client-billable-amount";

assert.equal(
  resolveClientBillableAmount({
    revenue_before_vat: 100_000,
    usage_rights_amount: 10_000,
    agency_fee_percent: 5,
    billable_amount: 100_000,
  }),
  115_500
);

const preview = computeClientInvoiceVatPreview({
  revenue_before_vat: 100_000,
  usage_rights_amount: 10_000,
  agency_fee_percent: 5,
  billable_amount: 100_000,
  invoiced_amount: 0,
  remaining_amount: 115_500,
  revenue_vat_percent: 14,
  revenue_vat_exempt: false,
});

assert.equal(preview.beforeVat, 115_500);
assert.equal(preview.vatAmount, 16_170);
assert.equal(preview.afterVat, 131_670);

assert.equal(
  resolveClientBillableAmount({
    revenue_before_vat: 0,
    agency_fee_amount: 5_000,
  }),
  5_000
);

assert.equal(
  resolveClientBillableAmount({
    revenue_before_vat: 0,
    usage_rights_amount: 2_000,
    agency_fee_amount: 5_000,
  }),
  7_000
);

console.log("client-billable-amount.test.ts: ok");
