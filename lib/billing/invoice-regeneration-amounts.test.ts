/**
 * Run: npx tsx lib/billing/invoice-regeneration-amounts.test.ts
 */
import { resolveInvoiceLineBeforeVat } from "@/lib/billing/invoice-from-deliverables";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testRegenerationUsesCorrectedCommercialAmount() {
  const amount = resolveInvoiceLineBeforeVat(
    {
      id: "del-1",
      campaign_line_id: "line-1",
      sort_order: 1,
      platform: "instagram",
      deliverable_type: "reel",
      quantity: 1,
      live_date: null,
      billable_amount: 5000,
      invoiced_amount: 3000,
      collected_amount: 0,
      disputed_amount: 0,
      remaining_amount: 3000,
      billing_status: "ready_to_invoice",
      invoice_line_item_id: null,
      locked_at: null,
      revenue_before_vat: 5000,
      revenue_vat_percent: 0,
      revenue_vat_exempt: false,
      label: "IG Reel",
    },
    { forRegeneration: true }
  );

  assert(amount === 5000, "regeneration should use corrected commercial amount, not stale remaining");
}

testRegenerationUsesCorrectedCommercialAmount();
console.log("invoice-regeneration-amounts: 1 passed");
