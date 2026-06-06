import { createSupabaseServerClient } from "@/lib/supabase/server";
import { asFinanceControlClient } from "@/lib/finance/supabase-finance";
import { REL } from "@/lib/supabase/relation-hints";
import type { AdjustmentModuleKey } from "@/lib/finance/status/document-kind";
import { ADJUSTMENT_MODULE_CONFIG } from "@/lib/finance/status/document-kind";
import { isActiveInvoiceForFinancialTotals } from "@/lib/finance/status";
import type {
  FinanceAdjustmentRegisterRow,
  InvoiceSearchResult,
} from "@/features/finance/adjustments/types";

const TABLE_BY_MODULE: Record<AdjustmentModuleKey, string> = {
  client_credit: "client_credit_notes",
  vendor_credit: "vendor_credit_notes",
  client_debit: "client_debit_notes",
  vendor_debit: "vendor_debit_notes",
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Unauthorized");
  return { supabase, user };
}

export async function searchInvoicesForAdjustment(options?: {
  query?: string;
  campaignHeaderId?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<InvoiceSearchResult[]> {
  const { supabase } = await requireUser();
  const limit = options?.limit ?? 50;

  let dbQuery = supabase
    .from("invoices")
    .select(
      `
      id,
      document_number,
      status,
      regeneration_status,
      issue_date,
      subtotal,
      tax_amount,
      total,
      revenue_before_vat,
      revenue_vat_amount,
      revenue_after_vat,
      currency,
      client:clients(name),
      campaign:${REL.invoices.campaignHeader}(
        document_number,
        name,
        brand:brands(name)
      )
    `
    )
    .not("status", "eq", "void")
    .order("issue_date", { ascending: false })
    .limit(limit);

  if (options?.campaignHeaderId) {
    dbQuery = dbQuery.eq("campaign_header_id", options.campaignHeaderId);
  }
  if (options?.clientId) {
    dbQuery = dbQuery.eq("client_id", options.clientId);
  }
  if (options?.dateFrom) {
    dbQuery = dbQuery.gte("issue_date", options.dateFrom);
  }
  if (options?.dateTo) {
    dbQuery = dbQuery.lte("issue_date", options.dateTo);
  }

  const { data, error } = await dbQuery;
  if (error) throw new Error(error.message);

  const needle = (options?.query ?? "").trim().toLowerCase();

  return (data ?? [])
    .map((raw) => {
      const inv = raw as unknown as {
        id: string;
        document_number: string;
        status: string;
        regeneration_status: string | null;
        issue_date: string;
        subtotal: number;
        tax_amount: number;
        total: number;
        revenue_before_vat?: number | null;
        revenue_vat_amount?: number | null;
        revenue_after_vat?: number | null;
        currency: string;
        client: { name: string } | null;
        campaign: {
          document_number: string;
          name: string;
          brand: { name: string } | null;
        } | null;
      };

      if (
        !isActiveInvoiceForFinancialTotals({
          status: inv.status,
          regeneration_status: inv.regeneration_status,
        })
      ) {
        return null;
      }

      const revenue_before_vat = Number(
        inv.revenue_before_vat ?? inv.subtotal ?? 0
      );
      const vat_amount = Number(inv.revenue_vat_amount ?? inv.tax_amount ?? 0);
      const total_after_vat = Number(
        inv.revenue_after_vat ?? inv.total ?? revenue_before_vat + vat_amount
      );

      const row: InvoiceSearchResult = {
        id: inv.id,
        document_number: inv.document_number,
        client_name: inv.client?.name ?? "—",
        brand_name: inv.campaign?.brand?.name ?? null,
        campaign_document_number: inv.campaign?.document_number ?? null,
        campaign_name: inv.campaign?.name ?? null,
        issue_date: inv.issue_date,
        revenue_before_vat,
        vat_amount,
        total_after_vat,
        currency: inv.currency,
        status: inv.status,
      };

      if (!needle) return row;

      const haystack = [
        row.document_number,
        row.client_name,
        row.brand_name,
        row.campaign_document_number,
        row.campaign_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle) ? row : null;
    })
    .filter((row): row is InvoiceSearchResult => Boolean(row));
}

export async function getAdjustmentRegister(
  moduleKey: AdjustmentModuleKey
): Promise<FinanceAdjustmentRegisterRow[]> {
  const { supabase } = await requireUser();
  const table = TABLE_BY_MODULE[moduleKey];
  const config = ADJUSTMENT_MODULE_CONFIG[moduleKey];
  const isClient = config.party === "client";

  const select = isClient
    ? `
      id, document_number, status, issue_date, reason,
      amount_before_vat, vat_amount, amount_after_vat, vat_affected, currency,
      posted_at,
      client:clients(name),
      invoice:invoices(document_number),
      campaign_header:campaign_headers(document_number, name)
    `
    : `
      id, document_number, status, issue_date, reason,
      amount_before_vat, vat_amount, amount_after_vat, vat_affected, currency,
      posted_at,
      vendor:influencers(display_name),
      vendor_io:vendor_ios(document_number),
      campaign_header:campaign_headers(document_number, name)
    `;

  const financeDb = asFinanceControlClient(supabase);
  const { data, error } = await financeDb
    .from(table)
    .select(select)
    .order("issue_date", { ascending: false })
    .limit(200);

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      document_number: String(row.document_number),
      status: String(row.status) as FinanceAdjustmentRegisterRow["status"],
      issue_date: String(row.issue_date),
      reason: String(row.reason),
      amount_before_vat: Number(row.amount_before_vat ?? 0),
      vat_amount: Number(row.vat_amount ?? 0),
      amount_after_vat: Number(row.amount_after_vat ?? 0),
      vat_affected: Boolean(row.vat_affected),
      currency: String(row.currency ?? "USD"),
      source_document_number: isClient
        ? ((row.invoice as { document_number?: string } | null)?.document_number ?? null)
        : ((row.vendor_io as { document_number?: string } | null)?.document_number ?? null),
      client_name: isClient
        ? ((row.client as { name?: string } | null)?.name ?? null)
        : null,
      vendor_name: !isClient
        ? ((row.vendor as { display_name?: string } | null)?.display_name ?? null)
        : null,
      campaign_document_number:
        (row.campaign_header as { document_number?: string } | null)?.document_number ?? null,
      campaign_name:
        (row.campaign_header as { name?: string } | null)?.name ?? null,
      posted_at: row.posted_at ? String(row.posted_at) : null,
    } satisfies FinanceAdjustmentRegisterRow;
  });
}
