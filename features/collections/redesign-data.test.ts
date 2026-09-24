import assert from "node:assert/strict";
import test from "node:test";
import { bucketIndex, collectionTab, dateLabel, groupCurrency, summarizeInvoices } from "./redesign-data";
import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
const invoice = (due_date: string | null, currency = "EGP"): CollectionInvoiceRow => ({ id: "i", client_id: "c", total: 100, amount_paid: 0, outstanding: 100, due_date, issue_date: "2020-01-01", currency, status: "issued", collection_status: "pending", aging_bucket: "current", days_past_due: 0 });
test("aging uses due dates with exact bucket boundaries and excludes undated invoices", () => {
  const asOf = "2026-09-24";
  assert.equal(bucketIndex("2026-09-24", asOf), 0);
  assert.equal(bucketIndex("2026-09-25", asOf), 0);
  assert.equal(bucketIndex("2026-09-23", asOf), 1);
  assert.equal(bucketIndex("2026-08-25", asOf), 1);
  assert.equal(bucketIndex("2026-08-24", asOf), 2);
  assert.equal(bucketIndex("2026-07-26", asOf), 2);
  assert.equal(bucketIndex("2026-07-25", asOf), 3);
  assert.equal(bucketIndex("2026-06-26", asOf), 3);
  assert.equal(bucketIndex("2026-06-25", asOf), 4);
  const summary = summarizeInvoices([invoice(null), invoice("2026-07-26")], asOf);
  assert.equal(summary.total, 200); assert.equal(summary.overdue, 100); assert.equal(summary.percent, 50); assert.equal(summary.buckets[0].count, 0); assert.equal(summary.undated, 1);
});
test("currency groups never combine native balances", () => {
  const groups = groupCurrency([invoice(null, "EGP"), invoice(null, "USD"), invoice(null, "AED")]);
  assert.deepEqual(groups.map(([code, rows]) => [code, rows.length]), [["AED", 1], ["EGP", 1], ["USD", 1]]);
});
test("new section links and legacy links resolve explicitly", () => {
  for (const key of ["dash", "aging", "overdue", "stmt", "fcast", "record", "pay"]) assert.equal(collectionTab(key), key);
  assert.equal(collectionTab("allocation"), "record"); assert.equal(collectionTab("payables"), "pay"); assert.equal(collectionTab("unknown"), "dash");
  assert.equal(dateLabel("2026-09-24"), "24 Sep 26"); assert.equal(dateLabel(null), "not set");
});
