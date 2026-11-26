import assert from "node:assert/strict";
import { assignmentInstallmentNumbers, invoiceInstallmentLabel } from "./invoice-installments";

const history = ["first", "second", "void", "third"].map((id, index) => ({
  id, created_at: `2026-10-0${index + 1}T00:00:00Z`, status: id === "void" ? "void" : "issued",
}));
const lines = [
  { invoice_id: "first", campaign_line_id: "a", revenue_before_vat: 250 },
  { invoice_id: "first", campaign_line_id: "a", revenue_before_vat: 250 },
  { invoice_id: "second", campaign_line_id: "a", revenue_before_vat: 250 },
  { invoice_id: "second", campaign_line_id: "b", revenue_before_vat: 100 },
  { invoice_id: "void", campaign_line_id: "a", revenue_before_vat: 250 },
  { invoice_id: "third", campaign_line_id: "a", revenue_before_vat: 250 },
];
assert.equal(assignmentInstallmentNumbers("first", history, lines).get("a"), 1);
assert.equal(assignmentInstallmentNumbers("second", history, lines).get("a"), 2);
assert.equal(assignmentInstallmentNumbers("second", history, lines).get("b"), 1);
assert.equal(assignmentInstallmentNumbers("third", history, lines).get("a"), 3);
assert.equal(assignmentInstallmentNumbers("void", history, lines).size, 0);
assert.equal(invoiceInstallmentLabel(2, "Creator A · 50% of original billable amount"), "50% of original billable amount");
assert.equal(invoiceInstallmentLabel(3, "Creator A · 25% of original billable amount"), "25% of original billable amount");
assert.equal(invoiceInstallmentLabel(11, "Creator A"), null);
assert.equal(invoiceInstallmentLabel(12, "Creator A"), null);
assert.equal(invoiceInstallmentLabel(13, "Creator A"), null);
assert.equal(invoiceInstallmentLabel(21, "Creator A"), null);
assert.equal(invoiceInstallmentLabel(undefined, "Creator A"), null);
console.log("Invoice installment scenarios passed");

assert.equal(invoiceInstallmentLabel(1, "Creator · 100% of original billable amount"), null);
