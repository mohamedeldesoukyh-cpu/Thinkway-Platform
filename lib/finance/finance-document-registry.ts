import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdjustmentTableKind } from "@/lib/finance/adjustment-table-config";
import { ADJUSTMENT_TABLE_CONFIG } from "@/lib/finance/adjustment-table-config";
import type { LinkedAdjustmentSummary } from "@/lib/finance/document-controls";
import { asFinanceControlClient } from "@/lib/finance/supabase-finance";
import type { FinanceDocumentKind } from "@/lib/finance/status/document-kind";
import { isActiveAdjustmentStatus } from "@/lib/finance/status/adjustment-status";

type FinanceDb = ReturnType<typeof asFinanceControlClient>;

export async function ensureInvoiceFinanceDocument(
  supabase: SupabaseClient,
  invoiceId: string,
  createdBy?: string | null
): Promise<string | null> {
  const financeDb = asFinanceControlClient(supabase);

  const { data: existing } = await financeDb
    .from("finance_documents")
    .select("id")
    .eq("source_table", "invoices")
    .eq("source_id", invoiceId)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, document_number, client_id, campaign_header_id, currency, subtotal, tax_amount, total, revenue_before_vat, revenue_vat_amount, revenue_after_vat, status"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !invoice) return null;

  const row = invoice as Record<string, unknown>;
  const { data: created, error: insertError } = await financeDb
    .from("finance_documents")
    .insert({
      document_kind: "client_invoice",
      document_number: String(row.document_number),
      source_table: "invoices",
      source_id: invoiceId,
      client_id: row.client_id,
      campaign_header_id: row.campaign_header_id,
      currency: row.currency ?? "USD",
      amount_before_vat: Number(row.revenue_before_vat ?? row.subtotal ?? 0),
      vat_amount: Number(row.revenue_vat_amount ?? row.tax_amount ?? 0),
      amount_after_vat: Number(row.revenue_after_vat ?? row.total ?? 0),
      status: String(row.status ?? "draft"),
      created_by: createdBy ?? null,
    })
    .select("id")
    .single();

  if (insertError || !created) return null;
  return String((created as { id: string }).id);
}

export async function syncFinanceDocumentStatus(
  financeDb: FinanceDb,
  input: {
    source_table: string;
    source_id: string;
    status: string;
    posted_at?: string | null;
    cancelled_at?: string | null;
    voided_at?: string | null;
    posting_batch_id?: string | null;
  }
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.posted_at !== undefined) patch.posted_at = input.posted_at;
  if (input.cancelled_at !== undefined) patch.cancelled_at = input.cancelled_at;
  if (input.voided_at !== undefined) patch.voided_at = input.voided_at;
  if (input.posting_batch_id !== undefined) patch.posting_batch_id = input.posting_batch_id;

  await financeDb
    .from("finance_documents")
    .update(patch)
    .eq("source_table", input.source_table)
    .eq("source_id", input.source_id);
}

export async function syncAdjustmentFinanceDocument(
  financeDb: FinanceDb,
  kind: AdjustmentTableKind,
  sourceId: string,
  status: string,
  extras?: { posted_at?: string | null; cancelled_at?: string | null; posting_batch_id?: string | null }
): Promise<void> {
  const config = ADJUSTMENT_TABLE_CONFIG[kind];
  await syncFinanceDocumentStatus(financeDb, {
    source_table: config.table,
    source_id: sourceId,
    status,
    ...extras,
  });
}

export async function isInvoicePostedToErp(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<boolean> {
  const financeDb = asFinanceControlClient(supabase);
  const { data } = await financeDb
    .from("finance_documents")
    .select("posted_at, posting_batch_id")
    .eq("source_table", "invoices")
    .eq("source_id", invoiceId)
    .maybeSingle();

  if (!data) return false;
  const row = data as { posted_at?: string | null; posting_batch_id?: string | null };
  return Boolean(row.posted_at || row.posting_batch_id);
}

export async function getLinkedAdjustmentsForInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<LinkedAdjustmentSummary[]> {
  const financeDb = asFinanceControlClient(supabase);

  const { data: invoiceRegistry } = await financeDb
    .from("finance_documents")
    .select("id")
    .eq("source_table", "invoices")
    .eq("source_id", invoiceId)
    .maybeSingle();

  if (!invoiceRegistry?.id) {
    return loadAdjustmentsByInvoiceId(supabase, invoiceId);
  }

  const { data: links } = await financeDb
    .from("finance_document_links")
    .select("source_document_id")
    .eq("target_document_id", invoiceRegistry.id)
    .eq("link_type", "adjustment_to_invoice");

  const sourceIds = (links ?? []).map((l) => (l as { source_document_id: string }).source_document_id);
  if (sourceIds.length === 0) {
    return loadAdjustmentsByInvoiceId(supabase, invoiceId);
  }

  const { data: docs } = await financeDb
    .from("finance_documents")
    .select("id, document_number, status, amount_after_vat, source_table, source_id")
    .in("id", sourceIds);

  return (docs ?? [])
    .filter((d) => isActiveAdjustmentStatus(String((d as { status: string }).status)))
    .map((d) => {
      const row = d as {
        id: string;
        document_number: string;
        status: string;
        amount_after_vat: number;
      };
      return {
        id: row.id,
        document_number: row.document_number,
        status: row.status,
        amount_after_vat: Number(row.amount_after_vat ?? 0),
      };
    });
}

async function loadAdjustmentsByInvoiceId(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<LinkedAdjustmentSummary[]> {
  const financeDb = asFinanceControlClient(supabase);
  const results: LinkedAdjustmentSummary[] = [];

  for (const table of ["client_credit_notes", "client_debit_notes"] as const) {
    const { data } = await financeDb
      .from(table)
      .select("id, document_number, status, amount_after_vat")
      .eq("invoice_id", invoiceId);

    for (const row of data ?? []) {
      const r = row as {
        id: string;
        document_number: string;
        status: string;
        amount_after_vat: number;
      };
      if (isActiveAdjustmentStatus(r.status)) {
        results.push({
          id: r.id,
          document_number: r.document_number,
          status: r.status,
          amount_after_vat: Number(r.amount_after_vat ?? 0),
        });
      }
    }
  }

  return results;
}

export function documentKindForAdjustment(kind: AdjustmentTableKind): FinanceDocumentKind {
  return ADJUSTMENT_TABLE_CONFIG[kind].document_kind;
}
