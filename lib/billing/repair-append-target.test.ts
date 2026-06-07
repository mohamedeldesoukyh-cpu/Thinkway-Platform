/**
 * Run: npx tsx lib/billing/repair-append-target.test.ts
 */
import { resolveRepairAppendTargetInvoiceId } from "@/lib/billing/repair-orphaned-invoice-state";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testMovedToBillingWithoutInvoiceLinkDoesNotAppend() {
  const target = resolveRepairAppendTargetInvoiceId(
    { invoice_id: null, billing_status: "moved_to_billing" },
    "inv-primary"
  );
  assert(target === null, "new IO line must not auto-append to primary invoice");
}

function testPartiallyInvoicedUsesPrimaryInvoice() {
  const target = resolveRepairAppendTargetInvoiceId(
    { invoice_id: null, billing_status: "partially_invoiced" },
    "inv-primary"
  );
  assert(target === "inv-primary", "partial invoice gap repair keeps primary invoice");
}

function testExplicitInvoiceLinkWins() {
  const target = resolveRepairAppendTargetInvoiceId(
    { invoice_id: "inv-linked", billing_status: "moved_to_billing" },
    "inv-primary"
  );
  assert(target === "inv-linked", "explicit invoice link is respected");
}

testMovedToBillingWithoutInvoiceLinkDoesNotAppend();
testPartiallyInvoicedUsesPrimaryInvoice();
testExplicitInvoiceLinkWins();
console.log("repair-append-target.test.ts: ok");
