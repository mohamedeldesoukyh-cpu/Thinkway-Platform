import assert from "node:assert/strict";
import test from "node:test";
import { convertMoney, projectBillingRows, originalBillingRows } from "./billing-currency";
import { computeInvoiceDraftLine, buildInvoiceDraftSubmit } from "./operational-invoice-draft";
import type { OperationalBillingRow } from "./operational-billing-rows";

const rates = { EGP: 1, USD: 52.2151, AED: 14, EUR: 56.75, GBP: 66.09, SAR: 13.924 };
const row = (currency = "USD", amount = 100): OperationalBillingRow => ({
  id: "a", kind: "assignment", currency_code: currency, campaign_line_id: "a",
  billable_amount: amount, remaining_amount: amount, invoiced_amount: 0, collected_amount: 0,
  revenue_before_vat: amount, revenue_vat_percent: 14, revenue_vat_exempt: false,
  is_invoice_eligible: true, is_locked: false, children: [],
} as OperationalBillingRow);

test("every supported currency converts via EGP without changing source amounts", () => {
  for (const source of Object.keys(rates)) for (const target of Object.keys(rates)) {
    const native = [row(source)];
    const projected = projectBillingRows(native, target, rates);
    assert.equal(projected[0].billable_amount, convertMoney(100, source, target, rates));
    assert.equal(originalBillingRows(projected)[0].billable_amount, 100);
    assert.equal(native[0].currency_code, source);
    assert.equal(projected[0].is_invoice_eligible, true);
  }
});
test("USD 18,448 is EGP 963,264.16 before assignment-level rounding", () => {
  assert.equal(convertMoney(18448, "USD", "EGP", rates), 963264.16);
});
test("repeated selector changes do not compound conversion or rounding", () => {
  const native = [row("USD", 123.45)];
  let projected = native;
  for (const target of ["EGP", "EUR", "AED", "USD", "EGP"]) projected = projectBillingRows(projected, target, rates);
  assert.equal(projected[0].billable_amount, convertMoney(123.45, "USD", "EGP", rates));
});
test("mixed currencies and children keep independent originals", () => {
  const parent = row("USD"); parent.children = [{ ...row("USD", 20), id: "child", currency_code: undefined }];
  const projected = projectBillingRows([parent, { ...row("AED"), id: "b" }], "EGP", rates);
  assert.equal(projected[0].children[0].billable_amount, 1044.3);
  assert.equal(projected[1].billable_amount, 1400);
  assert.equal(originalBillingRows(projected)[0].children[0].billable_amount, 20);
});
test("partial invoice preview converts the native slice once; submission remains native", () => {
  const projected = projectBillingRows([row("USD", 123.45)], "EGP", rates);
  const percent = { a: 33.33 };
  const draft = computeInvoiceDraftLine(projected[0], percent);
  const nativeDraft = computeInvoiceDraftLine(originalBillingRows(projected)[0], percent);
  assert.equal(draft.toBeInvoiced, convertMoney(nativeDraft.toBeInvoiced, "USD", "EGP", rates));
  assert.equal(draft.vatAmount, Math.round(draft.toBeInvoiced * .14 * 100) / 100);
  const submit = buildInvoiceDraftSubmit(originalBillingRows(projected), percent, { line_ids: ["a"], deliverable_ids: [], post_ids: [] });
  assert.equal(Object.values(submit.allocations)[0], nativeDraft.toBeInvoiced);
});
test("missing rates fail rather than relabeling native amounts", () => {
  assert.throws(() => projectBillingRows([row()], "EUR", { USD: 52 }), /Missing FX/);
});
