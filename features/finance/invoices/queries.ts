import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REL } from "@/lib/supabase/relation-hints";
import {
  getInvoiceOperationalState,
  type InvoiceRegistryRow,
} from "@/lib/finance/invoice-registry";
import {
  isActiveInvoiceForFinancialTotals,
  isRegisterInvoiceStatus,
} from "@/lib/finance/status";

import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";

const INVOICE_REGISTER_SELECT = `
  id,
  document_number,
  status,
  regeneration_status,
  is_operational_locked,
  issue_date,
  currency,
  subtotal,
  tax_amount,
  total,
  revenue_before_vat,
  revenue_vat_amount,
  revenue_after_vat,
  client:clients(name),
  campaign:${REL.invoices.campaignHeader}(
    name,
    document_number,
    brand:brands(name)
  )
`;

type InvoiceRegisterQueryRow = {
  id: string;
  document_number: string;
  status: string;
  regeneration_status: string | null;
  is_operational_locked?: boolean | null;
  issue_date: string;
  currency: string;
  subtotal?: number | null;
  tax_amount?: number | null;
  total?: number | null;
  revenue_before_vat?: number | null;
  revenue_vat_amount?: number | null;
  revenue_after_vat?: number | null;
  client: { name: string } | null;
  campaign: {
    name: string;
    document_number: string;
    brand: { name: string } | null;
  } | null;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return { supabase };
}

/** Resolve all invoice ids linked to a campaign (header FK, lines, deliverables, line items). */
export async function resolveCampaignInvoiceIds(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  options?: { includeVoid?: boolean }
): Promise<string[]> {
  const ids = new Set<string>();
  const includeVoid = options?.includeVoid ?? false;

  let directQuery = supabase
    .from("invoices")
    .select("id")
    .or(`campaign_header_id.eq.${campaignHeaderId},campaign_id.eq.${campaignHeaderId}`);

  if (!includeVoid) {
    directQuery = directQuery.not("status", "eq", "void");
  }

  const { data: directRows } = await directQuery;

  for (const row of directRows ?? []) {
    ids.add((row as { id: string }).id);
  }

  const { data: lineRows } = await supabase
    .from("campaign_lines")
    .select("invoice_id")
    .eq("campaign_header_id", campaignHeaderId)
    .not("invoice_id", "is", null);

  for (const row of lineRows ?? []) {
    const invoiceId = (row as { invoice_id: string | null }).invoice_id;
    if (invoiceId) ids.add(invoiceId);
  }

  const { data: lineItemRows } = await supabase
    .from("invoice_line_items")
    .select("invoice_id")
    .eq("campaign_header_id", campaignHeaderId);

  for (const row of lineItemRows ?? []) {
    const invoiceId = (row as { invoice_id: string | null }).invoice_id;
    if (invoiceId) ids.add(invoiceId);
  }

  const { data: campaignLines } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("campaign_header_id", campaignHeaderId);

  const lineIds = (campaignLines ?? []).map((row) => (row as { id: string }).id);
  if (lineIds.length > 0) {
    const { data: deliverableRows } = await supabase
      .from("assignment_deliverables")
      .select("invoice_line_item_id")
      .in("campaign_line_id", lineIds)
      .not("invoice_line_item_id", "is", null);

    const lineItemIds = (deliverableRows ?? [])
      .map((row) => (row as { invoice_line_item_id: string | null }).invoice_line_item_id)
      .filter(Boolean) as string[];

    if (lineItemIds.length > 0) {
      const { data: linkedItems } = await supabase
        .from("invoice_line_items")
        .select("invoice_id")
        .in("id", lineItemIds);

      for (const row of linkedItems ?? []) {
        const invoiceId = (row as { invoice_id: string | null }).invoice_id;
        if (invoiceId) ids.add(invoiceId);
      }
    }
  }

  return [...ids];
}

function isCampaignCancelledInvoice(
  inv: InvoiceRegisterQueryRow,
  options?: { includeCampaignCancelled?: boolean; campaignIsCancelled?: boolean }
): boolean {
  return inv.status === "void" && Boolean(options?.includeCampaignCancelled);
}

function mapInvoiceRegisterRow(
  inv: InvoiceRegisterQueryRow,
  options?: { includeCampaignCancelled?: boolean; campaignIsCancelled?: boolean }
): FinanceInvoiceRegisterRow | null {
  const includeCancelled = options?.includeCampaignCancelled ?? false;
  const campaignCancelled = isCampaignCancelledInvoice(inv, options);

  if (
    !campaignCancelled &&
    (!isRegisterInvoiceStatus(inv.status) ||
      !isActiveInvoiceForFinancialTotals({
        status: inv.status,
        regeneration_status: inv.regeneration_status,
      }))
  ) {
    return null;
  }

  if (campaignCancelled && !includeCancelled) {
    return null;
  }

  const revenue_before_vat = Number(inv.revenue_before_vat ?? inv.subtotal ?? 0);
  const vat_amount = Number(inv.revenue_vat_amount ?? inv.tax_amount ?? 0);
  const revenue_after_vat = Number(
    inv.revenue_after_vat ?? inv.total ?? revenue_before_vat + vat_amount
  );

  const registryRow: InvoiceRegistryRow = {
    id: inv.id,
    document_number: inv.document_number,
    status: inv.status,
    regeneration_status: inv.regeneration_status,
    is_operational_locked: inv.is_operational_locked,
    revenue_before_vat,
    vat_amount,
    revenue_after_vat,
  };

  return {
    id: inv.id,
    document_number: inv.document_number,
    client_name: inv.client?.name ?? "—",
    brand_name: inv.campaign?.brand?.name ?? null,
    campaign_name: inv.campaign?.name ?? null,
    campaign_document_number: inv.campaign?.document_number ?? null,
    revenue_before_vat,
    vat_amount,
    revenue_after_vat,
    status: inv.status,
    locked_status: getInvoiceOperationalState(registryRow).locked_status,
    created_date: inv.issue_date,
    currency: inv.currency,
    regeneration_status: inv.regeneration_status,
    is_operational_locked: inv.is_operational_locked ?? false,
    metadata:
      inv.status === "void"
        ? options?.campaignIsCancelled
          ? { campaign_cancelled: true }
          : { replaced_by_new_invoice: true }
        : null,
  } satisfies FinanceInvoiceRegisterRow;
}

export async function getFinanceInvoiceRegister(options?: {
  campaignHeaderId?: string;
}): Promise<FinanceInvoiceRegisterRow[]> {
  const { supabase } = await requireUser();

  let invoiceIds: string[] | null = null;
  let campaignIsCancelled = false;

  if (options?.campaignHeaderId) {
    const { data: header } = await supabase
      .from("campaign_headers")
      .select("status")
      .eq("id", options.campaignHeaderId)
      .maybeSingle();

    campaignIsCancelled = (header as { status?: string } | null)?.status === "cancelled";
    invoiceIds = await resolveCampaignInvoiceIds(supabase, options.campaignHeaderId, {
      includeVoid: true,
    });

    const directOnly = await supabase
      .from("invoices")
      .select("id")
      .eq("campaign_header_id", options.campaignHeaderId);

    const directIds = new Set((directOnly.data ?? []).map((row) => (row as { id: string }).id));
    const orphanIds = invoiceIds.filter((id) => !directIds.has(id));

    if (orphanIds.length > 0) {
      const { error: backfillError } = await supabase
        .from("invoices")
        .update({ campaign_header_id: options.campaignHeaderId })
        .in("id", orphanIds)
        .is("campaign_header_id", null);

      if (backfillError && process.env.NODE_ENV === "development") {
        console.warn("[finance-invoice-register] campaign_header_id backfill skipped", {
          campaignHeaderId: options.campaignHeaderId,
          orphanCount: orphanIds.length,
          message: backfillError.message,
        });
      }
    }

    if (invoiceIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("invoices")
    .select(INVOICE_REGISTER_SELECT)
    .order("issue_date", { ascending: false })
    .limit(500);

  if (!options?.campaignHeaderId) {
    query = query.not("status", "eq", "void");
  }

  if (invoiceIds) {
    query = query.in("id", invoiceIds);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const rows: FinanceInvoiceRegisterRow[] = [];

  for (const raw of data ?? []) {
    const mapped = mapInvoiceRegisterRow(raw as unknown as InvoiceRegisterQueryRow, {
      includeCampaignCancelled: Boolean(options?.campaignHeaderId),
      campaignIsCancelled,
    });
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    rows.push(mapped);
  }

  return rows;
}
