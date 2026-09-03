import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isLivePendingRegenerationInvoice,
  pendingInvoiceOverlapsReplacement,
} from "@/lib/billing/invoice-existing-target";
import { logFinanceAuditEvent } from "@/lib/finance/audit-log";
import { FINANCE_AUDIT_EVENTS } from "@/lib/finance/audit-events";
import {
  ensureInvoiceFinanceDocument,
  syncFinanceDocumentStatus,
} from "@/lib/finance/finance-document-registry";
import { asFinanceControlClient } from "@/lib/finance/supabase-finance";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";

/**
 * Document-only cancel. Do not unlock operational scope — the replacement
 * invoice already owns those lines.
 */
export async function cancelPendingInvoicesReplacedByNew(
  supabase: SupabaseClient,
  input: {
    campaignId: string;
    replacementInvoiceId: string;
    replacementDocumentNumber: string;
    actorId: string;
    touchedLineIds: string[];
  }
): Promise<{ cancelledIds: string[]; error?: string }> {
  const { data: pendingRows, error: pendingError } = await supabase
    .from("invoices")
    .select("id, document_number, status, regeneration_status")
    .or(`campaign_header_id.eq.${input.campaignId},campaign_id.eq.${input.campaignId}`)
    .eq("regeneration_status", "pending_regeneration")
    .neq("status", "void")
    .neq("id", input.replacementInvoiceId);

  if (pendingError) {
    return { cancelledIds: [], error: pendingError.message };
  }

  const pendingInvoices = (pendingRows ?? []).filter((row) =>
    isLivePendingRegenerationInvoice(row as { status: string; regeneration_status: string | null })
  );
  if (pendingInvoices.length === 0) {
    return { cancelledIds: [] };
  }

  const pendingIds = pendingInvoices.map((row) => (row as { id: string }).id);
  const { data: lineItems, error: lineItemError } = await supabase
    .from("invoice_line_items")
    .select("invoice_id, campaign_line_id")
    .in("invoice_id", pendingIds);

  if (lineItemError) {
    return { cancelledIds: [], error: lineItemError.message };
  }

  const lineIdsByInvoice = new Map<string, string[]>();
  for (const item of lineItems ?? []) {
    const row = item as { invoice_id: string; campaign_line_id: string | null };
    if (!row.campaign_line_id) continue;
    const list = lineIdsByInvoice.get(row.invoice_id) ?? [];
    list.push(row.campaign_line_id);
    lineIdsByInvoice.set(row.invoice_id, list);
  }

  const cancelledIds: string[] = [];
  const replacementLabel = formatDocumentNumberForDisplay(input.replacementDocumentNumber);
  const reason = `Replaced by new invoice ${replacementLabel}`;

  for (const invoice of pendingInvoices) {
    const pending = invoice as {
      id: string;
      document_number: string;
      status: string;
      regeneration_status: string | null;
    };
    if (
      !pendingInvoiceOverlapsReplacement({
        pendingInvoiceId: pending.id,
        replacementInvoiceId: input.replacementInvoiceId,
        pendingLineIds: lineIdsByInvoice.get(pending.id) ?? [],
        touchedLineIds: input.touchedLineIds,
      })
    ) {
      continue;
    }

    const { data: updated, error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "void",
        is_operational_locked: false,
        regeneration_status: "regenerated",
        ungenerate_reason: reason,
      } as never)
      .eq("id", pending.id)
      .neq("status", "void")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return { cancelledIds, error: updateError.message };
    }
    if (!updated) {
      continue;
    }

    await ensureInvoiceFinanceDocument(supabase, pending.id, input.actorId);
    await syncFinanceDocumentStatus(asFinanceControlClient(supabase), {
      source_table: "invoices",
      source_id: pending.id,
      status: "void",
      voided_at: new Date().toISOString(),
      posted_at: null,
      posting_batch_id: null,
    });

    await logFinanceAuditEvent(supabase, {
      event: FINANCE_AUDIT_EVENTS.invoice_cancelled,
      entity_type: "invoice",
      entity_id: pending.id,
      actor_id: input.actorId,
      old_data: { status: pending.status, regeneration_status: pending.regeneration_status },
      new_data: { status: "void", replaced_by_new_invoice: true },
      payload: {
        document_number: pending.document_number,
        replaced_by_invoice_id: input.replacementInvoiceId,
        replaced_by_document_number: input.replacementDocumentNumber,
        reason,
      },
    });

    cancelledIds.push(pending.id);
  }

  return { cancelledIds };
}
