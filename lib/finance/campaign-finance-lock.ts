/**
 * Platform Finance Lock gateway.
 *
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §7
 *
 * All modules (Commercial SSOT, POs, Vendor IOs, Invoices, Payments,
 * Change Orders, Budget Revisions, etc.) MUST use this API rather than
 * inventing their own lock checks.
 *
 * Conceptual API: Campaign.isFinanceLocked()
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isFinancialPeriodLocked,
  resolveFinancialPeriodLockForDate,
} from "@/lib/finance/period-lock";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type CampaignFinanceLockReason =
  | "vendor_io"
  | "client_io"
  | "purchase_order"
  | "invoice"
  | "client_credit_note"
  | "client_debit_note"
  | "vendor_credit_note"
  | "vendor_debit_note"
  | "payment"
  | "vendor_payment_batch"
  | "closed_accounting_period"
  | "finance_document";

export type FinanceLockResult = {
  locked: boolean;
  reasons: CampaignFinanceLockReason[];
};

async function exists(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<boolean> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/**
 * Evaluate whether any downstream finance artefact exists for the Campaign.
 * Single gateway for the entire platform.
 */
export async function isCampaignFinanceLocked(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<FinanceLockResult> {
  const id = campaignHeaderId?.trim();
  if (!id) return { locked: false, reasons: [] };

  const reasons: CampaignFinanceLockReason[] = [];

  const [
    vendorIo,
    clientIo,
    purchaseOrder,
    invoice,
    clientCn,
    clientDn,
    vendorCn,
    vendorDn,
    financeDoc,
    header,
  ] = await Promise.all([
    exists(
      supabase.from("vendor_ios").select("id").eq("campaign_header_id", id).limit(1)
    ),
    exists(
      supabase.from("client_ios").select("id").eq("campaign_header_id", id).limit(1)
    ),
    exists(
      supabase
        .from("campaign_purchase_orders")
        .select("id")
        .eq("campaign_header_id", id)
        .limit(1)
    ),
    exists(
      supabase.from("invoices").select("id").eq("campaign_header_id", id).limit(1)
    ),
    exists(
      supabase
        .from("client_credit_notes")
        .select("id")
        .eq("campaign_header_id", id)
        .limit(1)
    ),
    exists(
      supabase
        .from("client_debit_notes")
        .select("id")
        .eq("campaign_header_id", id)
        .limit(1)
    ),
    exists(
      supabase
        .from("vendor_credit_notes")
        .select("id")
        .eq("campaign_header_id", id)
        .limit(1)
    ),
    exists(
      supabase
        .from("vendor_debit_notes")
        .select("id")
        .eq("campaign_header_id", id)
        .limit(1)
    ),
    exists(
      supabase
        .from("finance_documents")
        .select("id")
        .eq("campaign_header_id", id)
        .limit(1)
    ),
    supabase
      .from("campaign_headers")
      .select("id, start_date, created_at")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (vendorIo) reasons.push("vendor_io");
  if (clientIo) reasons.push("client_io");
  if (purchaseOrder) reasons.push("purchase_order");
  if (invoice) reasons.push("invoice");
  if (clientCn) reasons.push("client_credit_note");
  if (clientDn) reasons.push("client_debit_note");
  if (vendorCn) reasons.push("vendor_credit_note");
  if (vendorDn) reasons.push("vendor_debit_note");
  if (financeDoc) reasons.push("finance_document");

  // Payments linked via invoices for this campaign
  if (invoice) {
    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id")
      .eq("campaign_header_id", id);
    const invoiceIds = (invoiceRows ?? []).map((r) => r.id as string);
    if (invoiceIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("id")
        .in("invoice_id", invoiceIds)
        .limit(1);
      if ((payments?.length ?? 0) > 0) reasons.push("payment");
    }
  }

  // Vendor payment batches on campaign influencers
  const { data: paidInfluencers } = await supabase
    .from("campaign_influencers")
    .select("id")
    .eq("campaign_header_id", id)
    .not("payment_batch_id", "is", null)
    .limit(1);
  if ((paidInfluencers?.length ?? 0) > 0) {
    reasons.push("vendor_payment_batch");
  }

  const headerRow = header.data as {
    start_date?: string | null;
    created_at?: string | null;
  } | null;
  if (headerRow) {
    const periodDate =
      headerRow.start_date ??
      (headerRow.created_at ? headerRow.created_at.slice(0, 10) : null);
    if (periodDate) {
      const period = await resolveFinancialPeriodLockForDate(supabase, periodDate);
      if (period && isFinancialPeriodLocked(period.status)) {
        reasons.push("closed_accounting_period");
      }
    }
  }

  return {
    locked: reasons.length > 0,
    reasons: [...new Set(reasons)],
  };
}

/**
 * Platform gateway matching the product API `Campaign.isFinanceLocked()`.
 * Prefer importing this object (or `isCampaignFinanceLocked`) from all modules.
 */
export const Campaign = {
  isFinanceLocked: isCampaignFinanceLocked,
};

export function formatFinanceLockReasons(
  reasons: CampaignFinanceLockReason[]
): string {
  if (reasons.length === 0) return "none";
  return reasons.join(", ");
}
