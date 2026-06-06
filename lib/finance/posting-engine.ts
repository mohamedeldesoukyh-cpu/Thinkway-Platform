import type { SupabaseClient } from "@supabase/supabase-js";

import { logFinanceAuditEvent } from "@/lib/finance/audit-log";
import { FINANCE_AUDIT_EVENTS } from "@/lib/finance/audit-events";
import { syncFinanceDocumentStatus } from "@/lib/finance/finance-document-registry";
import { guardDuplicatePosting, guardPostCancelledDoc } from "@/lib/finance/integrity-guards";
import { asFinanceControlClient } from "@/lib/finance/supabase-finance";
import type { FinanceDocumentKind } from "@/lib/finance/status/document-kind";
import type { FinancePostingBatchStatus } from "@/lib/finance/status/posting-status";
import type { Database } from "@/types/database";

export type PostingBatchPreviewDocument = {
  id: string;
  document_number: string;
  source_table: string;
  source_id: string;
  amount_before_vat: number;
  vat_amount: number;
  amount_after_vat: number;
  currency: string;
  status: string;
};

export type PostingEngineResult =
  | { ok: true; batch_id: string; document_number: string }
  | { ok: false; error: string };

export async function buildPostingBatchPreview(
  supabase: SupabaseClient,
  input: {
    transaction_type: FinanceDocumentKind;
    period_from: string;
    period_to: string;
    legal_entity_id?: string;
    currency?: string;
    status?: string;
  }
): Promise<PostingBatchPreviewDocument[]> {
  const financeDb = asFinanceControlClient(supabase);

  let query = financeDb
    .from("finance_documents")
    .select(
      "id, document_number, source_table, source_id, amount_before_vat, vat_amount, amount_after_vat, currency, status, created_at"
    )
    .eq("document_kind", input.transaction_type)
    .gte("created_at", `${input.period_from}T00:00:00Z`)
    .lte("created_at", `${input.period_to}T23:59:59Z`)
    .is("posting_batch_id", null)
    .order("document_number", { ascending: true })
    .limit(500);

  if (input.legal_entity_id) query = query.eq("client_id", input.legal_entity_id);
  if (input.currency) query = query.eq("currency", input.currency);
  if (input.status) query = query.eq("status", input.status);

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      document_number: String(row.document_number),
      source_table: String(row.source_table),
      source_id: String(row.source_id),
      amount_before_vat: Number(row.amount_before_vat ?? 0),
      vat_amount: Number(row.vat_amount ?? 0),
      amount_after_vat: Number(row.amount_after_vat ?? 0),
      currency: String(row.currency ?? "USD"),
      status: String(row.status),
    };
  });
}

export async function createPostingBatch(
  supabase: SupabaseClient<Database>,
  input: {
    transaction_type: FinanceDocumentKind;
    period_from: string;
    period_to: string;
    actor_id: string;
    legal_entity_id?: string;
    currency?: string;
    notes?: string;
  }
): Promise<PostingEngineResult & { preview?: PostingBatchPreviewDocument[] }> {
  const financeDb = asFinanceControlClient(supabase);
  const preview = await buildPostingBatchPreview(supabase, {
    transaction_type: input.transaction_type,
    period_from: input.period_from,
    period_to: input.period_to,
    legal_entity_id: input.legal_entity_id,
    currency: input.currency,
    status: "approved",
  });

  const totals = preview.reduce(
    (acc, row) => ({
      before: acc.before + row.amount_before_vat,
      vat: acc.vat + row.vat_amount,
      after: acc.after + row.amount_after_vat,
    }),
    { before: 0, vat: 0, after: 0 }
  );

  const { data: batch, error } = await financeDb
    .from("finance_posting_batches")
    .insert({
      transaction_type: input.transaction_type,
      period_from: input.period_from,
      period_to: input.period_to,
      legal_entity_id: input.legal_entity_id ?? null,
      currency: input.currency ?? preview[0]?.currency ?? null,
      status: "draft",
      document_count: preview.length,
      total_before_vat: totals.before,
      total_vat: totals.vat,
      total_after_vat: totals.after,
      notes: input.notes ?? null,
      metadata: { preview_document_ids: preview.map((d) => d.id) },
      created_by: input.actor_id,
    })
    .select("id, document_number")
    .single();

  if (error || !batch) {
    return { ok: false, error: error?.message ?? "Failed to create posting batch." };
  }

  const batchRow = batch as { id: string; document_number: string };

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.posting_created,
    entity_type: "finance_posting_batch",
    entity_id: batchRow.id,
    actor_id: input.actor_id,
    payload: {
      document_number: batchRow.document_number,
      document_count: preview.length,
      transaction_type: input.transaction_type,
    },
  });

  return {
    ok: true,
    batch_id: batchRow.id,
    document_number: batchRow.document_number,
    preview,
  };
}

export async function postPostingBatch(
  supabase: SupabaseClient<Database>,
  input: { batch_id: string; actor_id: string }
): Promise<PostingEngineResult> {
  const financeDb = asFinanceControlClient(supabase);

  const { data: batch, error: batchError } = await financeDb
    .from("finance_posting_batches")
    .select("*")
    .eq("id", input.batch_id)
    .maybeSingle();

  if (batchError || !batch) {
    return { ok: false, error: batchError?.message ?? "Posting batch not found." };
  }

  const batchRow = batch as Record<string, unknown>;
  const status = String(batchRow.status);

  const guard = guardDuplicatePosting({ already_posted: status === "posted", batch_status: status });
  if (!guard.allowed) return { ok: false, error: guard.reason };

  const metadata = (batchRow.metadata ?? {}) as { preview_document_ids?: string[] };
  const docIds = metadata.preview_document_ids ?? [];

  const { data: docs } = await financeDb
    .from("finance_documents")
    .select("id, source_table, source_id, status, document_number")
    .in("id", docIds.length > 0 ? docIds : ["00000000-0000-0000-0000-000000000000"]);

  const now = new Date().toISOString();
  const snapshot: Record<string, unknown>[] = [];

  for (const doc of docs ?? []) {
    const row = doc as {
      id: string;
      source_table: string;
      source_id: string;
      status: string;
      document_number: string;
    };

    const postGuard = guardPostCancelledDoc(row.status);
    if (!postGuard.allowed) continue;

    await syncFinanceDocumentStatus(financeDb, {
      source_table: row.source_table,
      source_id: row.source_id,
      status: "posted",
      posted_at: now,
      posting_batch_id: input.batch_id,
    });

    await financeDb
      .from("finance_documents")
      .update({ posting_batch_id: input.batch_id, posted_at: now, status: "posted" })
      .eq("id", row.id);

    snapshot.push({
      finance_document_id: row.id,
      document_number: row.document_number,
      posted_at: now,
    });
  }

  await financeDb
    .from("finance_posting_batches")
    .update({
      status: "posted" as FinancePostingBatchStatus,
      posted_at: now,
      metadata: {
        ...metadata,
        transaction_snapshot: snapshot,
      },
    })
    .eq("id", input.batch_id);

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.posting_posted,
    entity_type: "finance_posting_batch",
    entity_id: input.batch_id,
    actor_id: input.actor_id,
    payload: {
      document_number: String(batchRow.document_number),
      document_count: snapshot.length,
    },
  });

  return {
    ok: true,
    batch_id: input.batch_id,
    document_number: String(batchRow.document_number),
  };
}

export async function reversePostingBatch(
  supabase: SupabaseClient<Database>,
  input: { batch_id: string; actor_id: string; reason?: string }
): Promise<PostingEngineResult> {
  const financeDb = asFinanceControlClient(supabase);

  const { data: batch, error: batchError } = await financeDb
    .from("finance_posting_batches")
    .select("*")
    .eq("id", input.batch_id)
    .maybeSingle();

  if (batchError || !batch) {
    return { ok: false, error: batchError?.message ?? "Posting batch not found." };
  }

  const batchRow = batch as Record<string, unknown>;
  if (String(batchRow.status) !== "posted") {
    return { ok: false, error: "Only posted batches can be reversed." };
  }

  const metadata = (batchRow.metadata ?? {}) as {
    transaction_snapshot?: { finance_document_id: string }[];
    preview_document_ids?: string[];
  };

  const docIds =
    metadata.transaction_snapshot?.map((s) => s.finance_document_id) ??
    metadata.preview_document_ids ??
    [];

  const now = new Date().toISOString();

  if (docIds.length > 0) {
    const { data: docs } = await financeDb
      .from("finance_documents")
      .select("id, source_table, source_id, status")
      .in("id", docIds);

    for (const doc of docs ?? []) {
      const row = doc as { id: string; source_table: string; source_id: string; status: string };
      const reversalStatus = row.status === "posted" ? "approved" : row.status;

      await syncFinanceDocumentStatus(financeDb, {
        source_table: row.source_table,
        source_id: row.source_id,
        status: reversalStatus,
        posted_at: null,
        posting_batch_id: null,
      });

      await financeDb
        .from("finance_documents")
        .update({ posting_batch_id: null, posted_at: null, status: reversalStatus })
        .eq("id", row.id);
    }
  }

  await financeDb
    .from("finance_posting_batches")
    .update({
      status: "reversed" as FinancePostingBatchStatus,
      reversed_at: now,
      metadata: {
        ...metadata,
        reversal_reason: input.reason ?? null,
        reversed_at: now,
        reversed_by: input.actor_id,
      },
    })
    .eq("id", input.batch_id);

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.posting_reversed,
    entity_type: "finance_posting_batch",
    entity_id: input.batch_id,
    actor_id: input.actor_id,
    payload: {
      document_number: String(batchRow.document_number),
      reason: input.reason ?? null,
    },
  });

  return {
    ok: true,
    batch_id: input.batch_id,
    document_number: String(batchRow.document_number),
  };
}

export async function unpostPostingBatch(
  supabase: SupabaseClient<Database>,
  input: { batch_id: string; actor_id: string }
): Promise<PostingEngineResult> {
  const financeDb = asFinanceControlClient(supabase);

  const { data: batch } = await financeDb
    .from("finance_posting_batches")
    .select("id, document_number, status")
    .eq("id", input.batch_id)
    .maybeSingle();

  if (!batch) return { ok: false, error: "Posting batch not found." };
  const row = batch as { id: string; document_number: string; status: string };

  if (row.status !== "draft") {
    return { ok: false, error: "Only draft batches can be unposted (deleted from queue)." };
  }

  await financeDb
    .from("finance_posting_batches")
    .update({ status: "failed" as FinancePostingBatchStatus })
    .eq("id", input.batch_id);

  return { ok: true, batch_id: row.id, document_number: row.document_number };
}
