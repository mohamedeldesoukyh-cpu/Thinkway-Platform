import { createSupabaseServerClient } from "@/lib/supabase/server";
import { asFinanceControlClient } from "@/lib/finance/supabase-finance";
import type { FinanceDocumentKind } from "@/lib/finance/status/document-kind";
import type { FinancePostingBatchStatus } from "@/lib/finance/status/posting-status";

export type PostingPreviewRow = {
  id: string;
  document_number: string;
  document_kind: FinanceDocumentKind;
  party_name: string | null;
  campaign_document_number: string | null;
  amount_before_vat: number;
  vat_amount: number;
  amount_after_vat: number;
  currency: string;
  status: string;
};

export type PostingBatchRow = {
  id: string;
  document_number: string;
  transaction_type: FinanceDocumentKind;
  period_from: string;
  period_to: string;
  status: FinancePostingBatchStatus;
  document_count: number;
  total_after_vat: number;
  currency: string | null;
  posted_at: string | null;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Unauthorized");
  return { supabase };
}

export async function getPostingPreview(input: {
  transaction_type: FinanceDocumentKind;
  period_from: string;
  period_to: string;
  legal_entity_id?: string;
  currency?: string;
  status?: string;
}): Promise<PostingPreviewRow[]> {
  const { supabase } = await requireUser();
  const financeDb = asFinanceControlClient(supabase);

  let query = financeDb
    .from("finance_documents")
    .select(
      `
      id,
      document_number,
      document_kind,
      amount_before_vat,
      vat_amount,
      amount_after_vat,
      currency,
      status,
      client:clients(name),
      campaign:campaign_headers(document_number)
    `
    )
    .eq("document_kind", input.transaction_type)
    .gte("created_at", `${input.period_from}T00:00:00Z`)
    .lte("created_at", `${input.period_to}T23:59:59Z`)
    .order("document_number", { ascending: true })
    .limit(500);

  if (input.legal_entity_id) {
    query = query.eq("client_id", input.legal_entity_id);
  }
  if (input.currency) {
    query = query.eq("currency", input.currency);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      document_number: String(row.document_number),
      document_kind: row.document_kind as FinanceDocumentKind,
      party_name: (row.client as { name?: string } | null)?.name ?? null,
      campaign_document_number:
        (row.campaign as { document_number?: string } | null)?.document_number ?? null,
      amount_before_vat: Number(row.amount_before_vat ?? 0),
      vat_amount: Number(row.vat_amount ?? 0),
      amount_after_vat: Number(row.amount_after_vat ?? 0),
      currency: String(row.currency ?? "USD"),
      status: String(row.status),
    } satisfies PostingPreviewRow;
  });
}

export async function getPostingBatches(): Promise<PostingBatchRow[]> {
  const { supabase } = await requireUser();
  const financeDb = asFinanceControlClient(supabase);

  const { data, error } = await financeDb
    .from("finance_posting_batches")
    .select(
      "id, document_number, transaction_type, period_from, period_to, status, document_count, total_after_vat, currency, posted_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      document_number: String(row.document_number),
      transaction_type: row.transaction_type as FinanceDocumentKind,
      period_from: String(row.period_from),
      period_to: String(row.period_to),
      status: row.status as FinancePostingBatchStatus,
      document_count: Number(row.document_count ?? 0),
      total_after_vat: Number(row.total_after_vat ?? 0),
      currency: row.currency ? String(row.currency) : null,
      posted_at: row.posted_at ? String(row.posted_at) : null,
    };
  });
}
