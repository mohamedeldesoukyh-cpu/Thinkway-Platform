import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchCampaignHeaderForInvoice(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("campaign_headers")
    .select("id, client_id, currency_code, name")
    .eq("id", campaignId)
    .maybeSingle();
}

export async function insertInvoiceDraft(
  supabase: SupabaseClient,
  input: {
    client_id: string;
    campaign_header_id: string;
    due_date: string | null;
    currency: string;
    notes: string | null;
    billing_country_code: string | null;
    created_by: string;
  }
) {
  return supabase
    .from("invoices")
    .insert({
      client_id: input.client_id,
      campaign_header_id: input.campaign_header_id,
      status: "draft",
      due_date: input.due_date,
      currency: input.currency,
      notes: input.notes,
      billing_country_code: input.billing_country_code,
      created_by: input.created_by,
    })
    .select("id, document_number")
    .single();
}

export async function fetchInvoiceById(supabase: SupabaseClient, invoiceId: string) {
  return supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
}

export async function fetchInvoiceForUngenerate(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, total, subtotal, tax_amount, version_number, regeneration_status, status, is_operational_locked"
    )
    .eq("id", invoiceId)
    .maybeSingle();
}

export async function fetchInvoiceForRegenerate(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, version_number, regeneration_status"
    )
    .eq("id", invoiceId)
    .maybeSingle();
}

export async function fetchInvoiceLineItems(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order");
}

export async function verifyAppendDeliverableLinks(
  supabase: SupabaseClient,
  invoiceId: string,
  deliverableIds: string[]
) {
  return supabase
    .from("invoice_line_items")
    .select("assignment_deliverable_id")
    .eq("invoice_id", invoiceId)
    .in("assignment_deliverable_id", deliverableIds);
}

export async function countAppendPackageLineItems(
  supabase: SupabaseClient,
  invoiceId: string,
  lineIds: string[]
) {
  return supabase
    .from("invoice_line_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId)
    .in("campaign_line_id", lineIds);
}

export async function countInvoiceLineItems(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoice_line_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);
}

export async function updateInvoiceAfterRegenerate(
  supabase: SupabaseClient,
  invoiceId: string,
  versionNumber: number
) {
  return supabase
    .from("invoices")
    .update({
      version_number: versionNumber,
      regeneration_status: "active",
      status: "draft",
    } as never)
    .eq("id", invoiceId);
}

export async function fetchInvoiceTotals(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select("subtotal, tax_amount, total")
    .eq("id", invoiceId)
    .single();
}
