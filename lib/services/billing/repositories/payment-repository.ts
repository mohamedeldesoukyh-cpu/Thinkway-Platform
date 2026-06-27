import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchInvoiceForCollection(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select("id, client_id, campaign_header_id, document_number, currency")
    .eq("id", invoiceId)
    .maybeSingle();
}

export async function insertCollectionPayment(
  supabase: SupabaseClient,
  input: {
    invoice_id: string;
    client_id: string;
    amount: number;
    currency: string;
    payment_method: string;
    reference_number: string | null;
    notes: string | null;
    recorded_by: string;
  }
) {
  return supabase.from("payments").insert({
    invoice_id: input.invoice_id,
    client_id: input.client_id,
    amount: input.amount,
    currency: input.currency,
    status: "completed",
    payment_method: input.payment_method,
    reference_number: input.reference_number,
    notes: input.notes,
    paid_at: new Date().toISOString(),
    recorded_by: input.recorded_by,
  });
}

export async function fetchAssignmentForVendorPayment(
  supabase: SupabaseClient,
  assignmentId: string
) {
  return supabase
    .from("campaign_influencers")
    .select("id, agreed_fee, currency, campaign_header_id")
    .eq("id", assignmentId)
    .maybeSingle();
}

export async function insertVendorPaymentBatch(
  supabase: SupabaseClient,
  input: {
    name: string;
    total_amount: number;
    currency: string;
    notes: string | null;
    created_by: string;
  }
) {
  return supabase
    .from("vendor_payment_batches")
    .insert({
      name: input.name,
      status: "completed",
      total_amount: input.total_amount,
      currency: input.currency,
      notes: input.notes,
      created_by: input.created_by,
    })
    .select("id")
    .single();
}

export async function markAssignmentVendorPaid(
  supabase: SupabaseClient,
  assignmentId: string,
  batchId: string
) {
  return supabase
    .from("campaign_influencers")
    .update({
      vendor_payment_status: "paid",
      vendor_paid_at: new Date().toISOString(),
      payment_batch_id: batchId,
    })
    .eq("id", assignmentId);
}
