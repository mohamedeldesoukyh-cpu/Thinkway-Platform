import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVendorIoVatAmount } from "./vendor-io-vat";
import { resolveVendorIoTotalDue } from "./vendor-io-line-amount";

test("200K at 14% keeps assignment VAT despite three rounded allocations", () => {
  const children = Array.from({length: 3}, () => ({campaign_line_id: "a", cost_vat_amount: 9333.33}));
  const vat = resolveVendorIoVatAmount([{id: "a", cost_vat_amount: 28000}], children);
  assert.equal(vat, 28000);
  assert.equal(resolveVendorIoTotalDue(200000, 200000, vat), 228000);
});
test("preserves zero VAT and falls back only for missing parent amounts", () => {
  assert.equal(resolveVendorIoVatAmount([{id: "a", cost_vat_amount: 0}, {id: "b"}], [
    {campaign_line_id: "a", cost_vat_amount: 140},
    {campaign_line_id: "b", cost_vat_amount: 50.25},
  ]), 50.25);
  assert.equal(resolveVendorIoVatAmount([], [{campaign_line_id: "a", cost_vat_amount: 0.1}, {campaign_line_id: "a", cost_vat_amount: 0.2}]), 0.3);
});
