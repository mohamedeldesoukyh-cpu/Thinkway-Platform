import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { recordCollectionPaymentSchema } from "@/features/billing/schemas";
import { syncDeliverableCollectionsForInvoice } from "@/lib/billing/sync-deliverable-collections";
import { emptyToNull, type BillingMutationResult } from "./billing-helpers";

export async function recordCollectionPayment(supabase: SupabaseClient, userId: string, input: z.infer<typeof recordCollectionPaymentSchema>): Promise<BillingMutationResult> {const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("id, client_id, campaign_header_id, document_number, currency")
    .eq("id", input.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, message: invError?.message ?? "Invoice not found." };
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoice.id,
    client_id: invoice.client_id,
    amount: input.amount,
    currency: invoice.currency,
    status: "completed",
    payment_method: input.payment_method,
    reference_number: emptyToNull(input.reference_number),
    notes: emptyToNull(input.notes),
    paid_at: new Date().toISOString(),
    recorded_by: userId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await syncDeliverableCollectionsForInvoice(supabase, invoice.id);

  return { ok: true, message: `Payment recorded for ${invoice.document_number}.`, invoiceId: invoice.id, campaignId: invoice.campaign_header_id ?? undefined };

}
