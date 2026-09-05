import type { SupabaseClient } from "@supabase/supabase-js";

import { isActiveInvoiceForFinancialTotals } from "@/lib/billing/invoice-status";
import type { CampaignLineBillingStatus } from "@/lib/domains/campaign/types";
import { devLog } from "@/lib/dev-log";

export type CampaignInvoiceLineRollup = {
  campaign_header_id: string;
  invoiced_subtotal: number;
  line_count: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveInvoiceCampaignId(
  invoice: { campaign_header_id: string | null; campaign_id: string | null },
  requested: Set<string>
): string | null {
  if (invoice.campaign_header_id && requested.has(invoice.campaign_header_id)) {
    return invoice.campaign_header_id;
  }
  if (invoice.campaign_id && requested.has(invoice.campaign_id)) {
    return invoice.campaign_id;
  }
  return null;
}

function addRollupAmount(
  result: Map<string, CampaignInvoiceLineRollup>,
  campaignHeaderId: string,
  revenueBeforeVat: number
) {
  const amount = roundMoney(Number(revenueBeforeVat ?? 0));
  const existing = result.get(campaignHeaderId) ?? {
    campaign_header_id: campaignHeaderId,
    invoiced_subtotal: 0,
    line_count: 0,
  };
  existing.invoiced_subtotal = roundMoney(existing.invoiced_subtotal + amount);
  existing.line_count += 1;
  result.set(campaignHeaderId, existing);
}

/**
 * Same invoice discovery as `loadOperationalInvoiceLinkage`:
 * invoices.campaign_header_id OR invoices.campaign_id, then line items by invoice_id.
 * Falls back to invoice_line_items.campaign_header_id when the invoice query fails.
 */
async function loadInvoiceLineItemsByCampaignLinkage(
  supabase: SupabaseClient,
  requested: Set<string>
): Promise<{
  rows: Array<{
    id: string;
    invoice_id: string;
    campaignHeaderId: string;
    revenue_before_vat: number;
  }>;
  error?: string;
}> {
  const idList = [...requested].join(",");
  const { data: invoices, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, campaign_header_id, campaign_id, status, regeneration_status")
    .or(`campaign_header_id.in.(${idList}),campaign_id.in.(${idList})`)
    .neq("status", "void");

  if (invoiceError) {
    return { rows: [], error: invoiceError.message };
  }

  const invoiceToCampaign = new Map<string, string>();
  for (const invoice of invoices ?? []) {
    const typed = invoice as {
      id: string;
      campaign_header_id: string | null;
      campaign_id: string | null;
      status: string;
      regeneration_status: string | null;
    };
    if (
      !isActiveInvoiceForFinancialTotals({
        status: typed.status,
        regeneration_status: typed.regeneration_status,
      })
    ) {
      continue;
    }
    const campaignHeaderId = resolveInvoiceCampaignId(typed, requested);
    if (!campaignHeaderId) continue;
    invoiceToCampaign.set(typed.id, campaignHeaderId);
  }

  const invoiceIds = [...invoiceToCampaign.keys()];
  if (invoiceIds.length === 0) return { rows: [] };

  const { data, error } = await supabase
    .from("invoice_line_items")
    .select("id, invoice_id, revenue_before_vat")
    .in("invoice_id", invoiceIds);

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows: Array<{
    id: string;
    invoice_id: string;
    campaignHeaderId: string;
    revenue_before_vat: number;
  }> = [];

  for (const row of data ?? []) {
    const typed = row as {
      id: string;
      invoice_id: string;
      revenue_before_vat: number;
    };
    const campaignHeaderId = invoiceToCampaign.get(typed.invoice_id);
    if (!campaignHeaderId) continue;
    rows.push({
      id: typed.id,
      invoice_id: typed.invoice_id,
      campaignHeaderId,
      revenue_before_vat: Number(typed.revenue_before_vat ?? 0),
    });
  }

  return { rows };
}

/** Legacy path: line items that already store campaign_header_id. */
async function loadInvoiceLineItemsByLineCampaignId(
  supabase: SupabaseClient,
  campaignHeaderIds: string[]
): Promise<{
  rows: Array<{
    id: string;
    campaignHeaderId: string;
    revenue_before_vat: number;
  }>;
  error?: string;
}> {
  const { data, error } = await supabase
    .from("invoice_line_items")
    .select(
      "id, campaign_header_id, revenue_before_vat, invoice:invoices!inner(status, regeneration_status)"
    )
    .in("campaign_header_id", campaignHeaderIds);

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows: Array<{
    id: string;
    campaignHeaderId: string;
    revenue_before_vat: number;
  }> = [];

  for (const row of data ?? []) {
    const typed = row as unknown as {
      id: string;
      campaign_header_id: string | null;
      revenue_before_vat: number;
      invoice: { status: string; regeneration_status: string | null } | null;
    };
    if (!typed.campaign_header_id) continue;
    if (
      !typed.invoice ||
      !isActiveInvoiceForFinancialTotals({
        status: typed.invoice.status,
        regeneration_status: typed.invoice.regeneration_status,
      })
    ) {
      continue;
    }
    rows.push({
      id: typed.id,
      campaignHeaderId: typed.campaign_header_id,
      revenue_before_vat: Number(typed.revenue_before_vat ?? 0),
    });
  }

  return { rows };
}

/** Sum invoice_line_items.revenue_before_vat per campaign (non-void invoices). */
export async function loadCampaignInvoiceLineRollups(
  supabase: SupabaseClient,
  campaignHeaderIds: string[]
): Promise<Map<string, CampaignInvoiceLineRollup>> {
  const result = new Map<string, CampaignInvoiceLineRollup>();
  const requested = new Set(campaignHeaderIds.filter(Boolean));
  if (requested.size === 0) return result;

  const linked = await loadInvoiceLineItemsByCampaignLinkage(supabase, requested);
  if (linked.error && process.env.NODE_ENV === "development") {
    devLog("[invoice-aggregation] invoice linkage rollup query failed", {
      error: linked.error,
      campaignCount: requested.size,
    });
  }

  const seenLineIds = new Set<string>();
  for (const row of linked.rows) {
    if (seenLineIds.has(row.id)) continue;
    seenLineIds.add(row.id);
    addRollupAmount(result, row.campaignHeaderId, row.revenue_before_vat);
  }

  const byLineCampaign = await loadInvoiceLineItemsByLineCampaignId(supabase, [...requested]);
  if (byLineCampaign.error && process.env.NODE_ENV === "development") {
    devLog("[invoice-aggregation] line item rollup query failed", {
      error: byLineCampaign.error,
      campaignCount: requested.size,
    });
  }

  for (const row of byLineCampaign.rows) {
    if (seenLineIds.has(row.id)) continue;
    seenLineIds.add(row.id);
    addRollupAmount(result, row.campaignHeaderId, row.revenue_before_vat);
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[invoice-aggregation] campaign line rollups", {
      campaignCount: requested.size,
      withLines: result.size,
      linkedRows: linked.rows.length,
      lineCampaignRows: byLineCampaign.rows.length,
    });
  }

  return result;
}

export function reconcileCampaignRollupWithInvoiceLines(input: {
  achieved_revenue: number;
  already_invoiced: number;
  remaining_to_invoice: number;
  unachieved_revenue: number;
  total_campaign_amount: number;
  invoice_line_invoiced: number;
}): {
  already_invoiced: number;
  remaining_to_invoice: number;
} {
  const operationalInvoiced = roundMoney(input.already_invoiced);
  const lineInvoiced = roundMoney(input.invoice_line_invoiced);
  const already_invoiced =
    lineInvoiced > 0 ? lineInvoiced : operationalInvoiced;
  const remaining_to_invoice = roundMoney(
    Math.max(0, input.total_campaign_amount - already_invoiced)
  );

  if (process.env.NODE_ENV === "development" && lineInvoiced !== operationalInvoiced) {
    devLog("[billing-sync] reconciled invoiced totals from active invoice_line_items", {
      operationalInvoiced,
      lineInvoiced,
      already_invoiced,
      remaining_to_invoice,
      total_campaign_amount: input.total_campaign_amount,
    });
  }

  return { already_invoiced, remaining_to_invoice };
}

/**
 * Invoice line items are the billed SSOT. Do not take max(operational, lines):
 * a 60% slice can leave deliverable remaining at 0 while line items are only 60%.
 */
export function mergeQueueRollupWithInvoiceLines(input: {
  total_campaign_amount: number;
  achieved_revenue: number;
  already_invoiced: number;
  remaining_to_invoice: number;
  unachieved_revenue: number;
  billing_status: CampaignLineBillingStatus;
  invoice_line_invoiced: number;
}): {
  already_invoiced: number;
  remaining_to_invoice: number;
  billing_status: CampaignLineBillingStatus;
} {
  const reconciled = reconcileCampaignRollupWithInvoiceLines(input);
  const already_invoiced = reconciled.already_invoiced;
  const remaining_to_invoice = reconciled.remaining_to_invoice;
  const billing_status: CampaignLineBillingStatus =
    remaining_to_invoice <= 0.01 && already_invoiced > 0.01
      ? "invoiced"
      : already_invoiced > 0.01
        ? "partially_invoiced"
        : input.billing_status;

  return { already_invoiced, remaining_to_invoice, billing_status };
}
