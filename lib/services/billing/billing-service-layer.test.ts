import assert from "node:assert/strict";
import { emptyToNull, buildInvoiceCreateSuccessMessage, lineBillingPatch } from "./billing-helpers";
import { parseInvoiceBillingMode } from "@/lib/billing/invoice-validation-context";

async function main() {
  assert.equal(emptyToNull(""), null);
  assert.equal(emptyToNull("  notes  "), "notes");
  assert.deepEqual(lineBillingPatch("closed"), { billing_status: "closed", assignment_status: "closed" });
  const msg = buildInvoiceCreateSuccessMessage({
    invoiceMode: parseInvoiceBillingMode("new"),
    documentNumber: "TW-INV-2026-0001",
    invoicedRowCount: 2,
    requestedLineIds: ["a", "b", "c"],
    touchedLineIds: ["a", "b"],
  });
  assert.ok(msg.includes("Created invoice"));
  assert.ok(msg.includes("1 selected assignment"));
  console.log("billing-service-layer.test.ts: all assertions passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
