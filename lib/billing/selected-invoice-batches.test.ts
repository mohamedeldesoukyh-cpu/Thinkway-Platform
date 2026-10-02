import assert from "node:assert/strict";
import test from "node:test";
import type { OperationalBillingRow } from "./operational-billing-rows";
import { createEmptySelection, getRowSelectionStatus, toggleOperationalRowSelection, selectionToSubmitPayload, getGlobalSelectionStatus } from "./operational-selection";
import { buildInvoiceDraftSubmit, computeInvoiceDraftLine, cascadeInvoiceDraftPercent } from "./operational-invoice-draft";
import { invoicePercentageDescription, runSeparateInvoices, splitInvoiceSelection, selectedInvoiceRows, separateInvoiceCount } from "./selected-invoice-batches";
import { originalBillingRows, projectBillingRows } from "./billing-currency";

function row(id: string, extras: Partial<OperationalBillingRow> = {}): OperationalBillingRow {
  return { id, kind: "assignment", campaign_line_id: id, campaign_header_id: "campaign", parent_id: null,
    billable_amount: 1000, remaining_amount: 1000, invoiced_amount: 0, collected_amount: 0,
    revenue_before_vat: 1000, revenue_vat_percent: 14, revenue_vat_exempt: false,
    currency_code: "USD", line_billing_status: "moved_to_billing", billing_status: "ready_to_invoice",
    operational_status: "io_issued", vendor_io_id: "io", is_invoice_eligible: true, is_locked: false,
    pricing_mode: "package", children: [], ...extras } as OperationalBillingRow;
}

test("package checkbox stays checked and toggles off even with hidden selectable children", () => {
  const child = row("post", { kind: "post", campaign_line_id: "a", parent_id: "a" });
  const root = row("a", { children: [child] });
  const selected = toggleOperationalRowSelection(root, createEmptySelection(), [root]);
  assert.equal(selected.line_ids.has("a"), true);
  assert.equal(selected.post_ids.size, 0);
  assert.equal(getRowSelectionStatus(root, selected), "checked");
  assert.equal(getGlobalSelectionStatus([root], selected), "checked");
  const cleared = toggleOperationalRowSelection(root, selected, [root]);
  assert.equal(getRowSelectionStatus(root, cleared), "unchecked");
  assert.deepEqual(selectionToSubmitPayload(cleared, [root]), { line_ids: [], deliverable_ids: [], post_ids: [] });
});

test("a second 50% invoice bills 50% of original, not half the remaining balance", () => {
  const draft = computeInvoiceDraftLine(row("a", { invoiced_amount: 500, remaining_amount: 500 }), { a: 50 });
  assert.equal(draft.toBeInvoiced, 500);
  assert.equal(draft.vatAmount, 70);
  assert.equal(draft.totalInvoice, 570);
  assert.equal(draft.remaining, 0);
  assert.equal(draft.percent, 50);
});

test("requested percentages never exceed remaining revenue and default consumes exact cents", () => {
  const partial = row("a", { invoiced_amount: 800, remaining_amount: 200 });
  assert.equal(computeInvoiceDraftLine(partial, { a: 50 }).toBeInvoiced, 200);
  assert.equal(computeInvoiceDraftLine(partial, { a: 50 }).percent, 20);
  const cents = row("a", { billable_amount: 333.33, remaining_amount: 111.11 });
  assert.equal(computeInvoiceDraftLine(cents, {}).toBeInvoiced, 111.11);
});

test("selected calculator does not affect unselected rows or hidden siblings", () => {
  const rows = [row("a"), row("b"), row("c")];
  const selection = { line_ids: ["a", "c"], post_ids: [], deliverable_ids: [] };
  let percents = {};
  for (const selected of selectedInvoiceRows(rows, selection)) percents = cascadeInvoiceDraftPercent(rows, selected.id, 50, percents);
  assert.equal(computeInvoiceDraftLine(rows[1], percents).toBeInvoiced, 1000);
  const bundle = buildInvoiceDraftSubmit(rows, percents, selection);
  assert.deepEqual(bundle.allocations, { "assignment:a": 500, "assignment:c": 500 });
  assert.equal(separateInvoiceCount(rows, percents, selection), 2);
});

test("separate client invoices group selected posts by assignment without selecting sibling posts", () => {
  const rows = [row("a", { children: [row("a1", { kind: "post", campaign_line_id: "a" }), row("a2", { kind: "post", campaign_line_id: "a" })] }), row("b")];
  const groups = splitInvoiceSelection(rows, { line_ids: ["b"], deliverable_ids: [], post_ids: ["a1"] });
  assert.deepEqual(groups, [{ line_ids: [], deliverable_ids: [], post_ids: ["a1"] }, { line_ids: ["b"], deliverable_ids: [], post_ids: [] }]);
});

test("separate invoices reuse the generator sequentially and stop after a failure", async () => {
  const groups = ["a", "b", "c"].map(id => ({ line_ids: [id], deliverable_ids: [], post_ids: [] }));
  const calls: string[] = [];
  let serial = 41;
  const result = await runSeparateInvoices(groups, async group => {
    calls.push(group.line_ids[0]);
    if (group.line_ids[0] === "b") return { ok: false, message: "PO limit" };
    return { ok: true, invoiceId: String(++serial) };
  });
  assert.deepEqual(calls, ["a", "b"]);
  assert.equal(result.completed[0].invoiceId, "42");
  assert.equal(result.failure?.message, "PO limit");
});

test("separate invoice successes preserve consecutive serials and handle thrown failures", async () => {
  const groups = ["a", "b"].map(id => ({ line_ids: [id], deliverable_ids: [], post_ids: [] }));
  let serial = 42;
  const result = await runSeparateInvoices(groups, async () => ({ ok: true, invoiceId: String(++serial) }));
  assert.deepEqual(result.completed.map(item => item.invoiceId), ["43", "44"]);
  const failed = await runSeparateInvoices(groups, async () => { throw new Error("connection lost"); });
  assert.equal(failed.error, "connection lost");
  assert.equal(failed.completed.length, 0);
});

test("partial invoices keep native currency allocations and visible percentage descriptions", () => {
  const native = row("a", { billable_amount: 123.45, remaining_amount: 61.72, invoiced_amount: 61.73 });
  const projected = projectBillingRows([native], "EGP", { USD: 52.2151, EGP: 1 });
  const bundle = buildInvoiceDraftSubmit(originalBillingRows(projected), { a: 50 }, { line_ids: ["a"], deliverable_ids: [], post_ids: [] });
  assert.equal(bundle.allocations["assignment:a"], 61.72);
  assert.equal(invoicePercentageDescription("Campaign line A", 500, 1000), "Campaign line A · 50% of original billable amount");
  assert.equal(invoicePercentageDescription("Campaign line A", 1000, 1000), "Campaign line A");
});
