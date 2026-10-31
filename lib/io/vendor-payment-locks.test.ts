import assert from "node:assert/strict";
import { test } from "node:test";
import { explainVendorIoGenerateEligibility as generate } from "./vendor-io-generate-eligibility";
import { isLineUngenerateIoEligible as reopen } from "./vendor-io-ungenerate-eligibility";
for (const billing of ["draft", "invoiced", "partially_paid", "paid", "closed"]) {
 test(`client billing ${billing} does not lock unpaid vendor IOs`, () => {
  const line = { influencer_id: "creator", invoice_id: "client-invoice", billing_status: billing, operational_status: "invoiced", vendor_payment_locked: false };
  assert.equal(generate(line).eligible, true);
  assert.equal(reopen({...line, vendor_io_id: "vendor-io"}), true);
 });
}
test("a vendor payment locks generation and reopening until cleared", () => {
 const line = { influencer_id: "creator", invoice_id: null, billing_status: "draft", operational_status: "draft", vendor_payment_locked: true };
 assert.equal(generate(line).eligible, false);
 assert.equal(reopen({...line, vendor_io_id: "vendor-io"}), false);
 assert.equal(generate({...line, vendor_payment_locked: false}).eligible, true);
 assert.equal(reopen({...line, vendor_io_id: "vendor-io", vendor_payment_locked: false}), true);
});
test("creator assignment and duplicate IO protections remain", () => {
 assert.equal(generate({}).eligible, false);
 assert.equal(generate({influencer_id: "creator", vendor_io_id: "existing"}).eligible, false);
});
