import type { SupabaseClient } from "@supabase/supabase-js";

import { REL } from "@/lib/supabase/relation-hints";

export async function fetchDashboardLines(supabase: SupabaseClient) {
  return supabase
    .from("campaign_lines")
    .select(
      `
        id, document_number, name, campaign_header_id, billing_status,
        revenue, revenue_before_vat, usage_rights_amount, agency_fee_percent, agency_fee_amount,
        cost, profit, po_amount, po_consumed, remaining_po,
        revenue_vat_amount, cost_vat_amount,
        revenue_locked, cost_locked, vendor_assignment_locked,
        currency_code, invoice_id,
        header:${REL.campaignLines.campaignHeader}(id, name, document_number,
          po_amount_campaign_currency, po_consumed_amount, po_remaining_amount,
          po_remaining_percent, po_status, po_expiry_date,
          client:clients(name),
          brand:brands(name)
        ),
        invoice:invoices(document_number)
      `
    )
    .order("updated_at", { ascending: false })
    .limit(200);
}

export async function fetchDashboardInvoices(supabase: SupabaseClient) {
  return supabase
    .from("invoices")
    .select(
      `
        id, document_number, client_id, campaign_header_id, status,
        collection_status, issue_date, due_date, total, amount_paid, currency,
        client:clients(name),
        campaign:${REL.invoices.campaignHeader}(name)
      `
    )
    .not("status", "eq", "void")
    .order("issue_date", { ascending: false })
    .limit(100);
}

export async function fetchVendorPaymentBatches(supabase: SupabaseClient) {
  return supabase
    .from("vendor_payment_batches")
    .select("id, document_number, name, status, batch_date, total_amount, currency")
    .order("batch_date", { ascending: false })
    .limit(20);
}

export async function fetchPendingFinancialApprovals(supabase: SupabaseClient) {
  return supabase
    .from("financial_approval_requests")
    .select(
      `
        id, document_number, entity_type, entity_id, approval_stage,
        chain_order, status, title, decided_at,
        assignee:profiles!financial_approval_requests_assigned_to_fkey(full_name, email)
      `
    )
    .in("status", ["pending", "in_review"])
    .order("created_at", { ascending: false })
    .limit(30);
}

export async function fetchUnpaidVendorCosts(supabase: SupabaseClient) {
  return supabase
    .from("campaign_influencers")
    .select("agreed_fee, vendor_payment_status")
    .neq("vendor_payment_status", "paid");
}
