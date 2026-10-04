import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceMilestoneDueDate, legacySplitPaymentMilestones } from "./invoice-payment-deadline";
import { buildClientIoMilestoneTemplate } from "@/lib/io/client-io-milestones";
import { agingBasisForMode } from "@/lib/finance/aging/types";
import { computeFinanceAgingBucket } from "@/lib/finance/aging/compute-bucket";
import { homeInvoiceBalances, homeInvoicesDueSoon } from "@/features/home/finance-summary";

test("Net 60 follows invoice date, not earlier IO approval; aging and alerts use same deadline", () => {
 const due = invoiceMilestoneDueDate(buildClientIoMilestoneTemplate("net_60")[0], {invoiceDate: "2026-10-04", approvedAt: "2026-08-09"});
 assert.equal(due, "2026-12-03");
 const invoice = {status: "sent", issue_date: "2026-10-04", due_date: due, total: 100, amount_paid: 0, currency: "EGP"};
 assert.equal(agingBasisForMode("client"), "due_date");
 assert.equal(computeFinanceAgingBucket(invoice, 100, "due_date", new Date("2026-12-02T12:00:00Z")), "current");
 assert.equal(homeInvoiceBalances([invoice], n => n, "2026-12-03").overdue, 0);
 assert.equal(homeInvoiceBalances([invoice], n => n, "2026-12-04").overdue, 100);
 assert.equal(homeInvoicesDueSoon([invoice], n => n, "2026-11-25").count, 0);
 assert.equal(homeInvoicesDueSoon([invoice], n => n, "2026-11-26").count, 1);
 assert.equal(homeInvoicesDueSoon([{...invoice, amount_paid: 100}, {...invoice, status: "void"}], n => n, "2026-11-26").count, 0);
});
test("Completion installments require actual event date and apply offset", () => {
 const m = {...buildClientIoMilestoneTemplate("completion_100")[0], dueOffsetDays: 45};
 assert.equal(invoiceMilestoneDueDate(m, {invoiceDate:"2026-10-04"}), null);
 assert.equal(invoiceMilestoneDueDate(m, {invoiceDate:"2026-10-04", eventDate:"2026-10-10"}), "2026-11-24");
 assert.equal(invoiceMilestoneDueDate({...m, dueDate:"2026-12-01"}, {invoiceDate:"2026-10-04"}), "2026-12-01");
});

test("Existing free-text advance/completion terms become two selectable installments", () => {
 const rows = legacySplitPaymentMilestones("50% advance payment upon confirmation, and the remaining 50% payable within 45 days from the campaign completion date.");
 assert.equal(rows?.length, 2);
 assert.equal(rows?.[0].percent, 50);
 assert.equal(rows?.[1].dueOffsetDays, 45);
 assert.equal(legacySplitPaymentMilestones("Custom terms to be agreed"), null);
});
