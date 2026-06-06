import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ADJUSTMENT_TABLE_CONFIG,
  adjustmentAuditEvent,
  type AdjustmentRow,
  type AdjustmentTableKind,
} from "@/lib/finance/adjustment-table-config";
import { logFinanceAuditEvent } from "@/lib/finance/audit-log";
import { adjustmentUnpostResultStatus } from "@/lib/finance/document-controls";
import { syncAdjustmentFinanceDocument } from "@/lib/finance/finance-document-registry";
import {
  guardApproveAdjustment,
  guardCancelAdjustment,
  guardPostAdjustment,
  guardReopenAdjustment,
  guardUnpostAdjustment,
} from "@/lib/finance/integrity-guards";
import { asFinanceControlClient } from "@/lib/finance/supabase-finance";
import type { FinanceAdjustmentStatus } from "@/lib/finance/status/adjustment-status";
import type { Database } from "@/types/database";

export type AdjustmentLifecycleResult =
  | { ok: true; status: FinanceAdjustmentStatus; document_number: string }
  | { ok: false; error: string };

type LifecycleContext = {
  supabase: SupabaseClient<Database>;
  kind: AdjustmentTableKind;
  id: string;
  actorId: string;
  reason?: string;
};

async function loadAdjustment(
  supabase: SupabaseClient,
  kind: AdjustmentTableKind,
  id: string
): Promise<AdjustmentRow | null> {
  const financeDb = asFinanceControlClient(supabase);
  const config = ADJUSTMENT_TABLE_CONFIG[kind];
  const { data, error } = await financeDb
    .from(config.table)
    .select("id, document_number, status, amount_after_vat, campaign_header_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as AdjustmentRow;
  return row;
}

async function transitionAdjustment(
  ctx: LifecycleContext,
  nextStatus: FinanceAdjustmentStatus,
  patch: Record<string, unknown>,
  auditAction: "approved" | "posted" | "cancelled" | "reopened" | "unposted"
): Promise<AdjustmentLifecycleResult> {
  const financeDb = asFinanceControlClient(ctx.supabase);
  const config = ADJUSTMENT_TABLE_CONFIG[ctx.kind];
  const current = await loadAdjustment(ctx.supabase, ctx.kind, ctx.id);

  if (!current) {
    return { ok: false, error: "Adjustment not found." };
  }

  const { error } = await financeDb
    .from(config.table)
    .update({ status: nextStatus, ...patch, updated_at: new Date().toISOString() })
    .eq("id", ctx.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await syncAdjustmentFinanceDocument(financeDb, ctx.kind, ctx.id, nextStatus, {
    posted_at: patch.posted_at as string | null | undefined,
    cancelled_at: patch.cancelled_at as string | null | undefined,
    posting_batch_id: patch.posting_batch_id as string | null | undefined,
  });

  await logFinanceAuditEvent(ctx.supabase, {
    event: adjustmentAuditEvent(ctx.kind, auditAction),
    entity_type: config.entity_type,
    entity_id: ctx.id,
    actor_id: ctx.actorId,
    old_data: { status: current.status },
    new_data: { status: nextStatus },
    payload: {
      document_number: current.document_number,
      reason: ctx.reason ?? null,
      campaign_header_id: current.campaign_header_id,
    },
  });

  return { ok: true, status: nextStatus, document_number: current.document_number };
}

export async function approveFinanceAdjustment(
  ctx: LifecycleContext
): Promise<AdjustmentLifecycleResult> {
  const current = await loadAdjustment(ctx.supabase, ctx.kind, ctx.id);
  if (!current) return { ok: false, error: "Adjustment not found." };

  const guard = guardApproveAdjustment(current.status);
  if (!guard.allowed) return { ok: false, error: guard.reason };

  return transitionAdjustment(ctx, "approved", {}, "approved");
}

export async function postFinanceAdjustment(
  ctx: LifecycleContext & { posting_batch_id?: string | null }
): Promise<AdjustmentLifecycleResult> {
  const current = await loadAdjustment(ctx.supabase, ctx.kind, ctx.id);
  if (!current) return { ok: false, error: "Adjustment not found." };

  const guard = guardPostAdjustment(current.status);
  if (!guard.allowed) return { ok: false, error: guard.reason };

  const now = new Date().toISOString();
  return transitionAdjustment(
    ctx,
    "posted",
    {
      posted_at: now,
      posting_batch_id: ctx.posting_batch_id ?? null,
    },
    "posted"
  );
}

export async function cancelFinanceAdjustment(
  ctx: LifecycleContext
): Promise<AdjustmentLifecycleResult> {
  const current = await loadAdjustment(ctx.supabase, ctx.kind, ctx.id);
  if (!current) return { ok: false, error: "Adjustment not found." };

  const guard = guardCancelAdjustment(current.status);
  if (!guard.allowed) return { ok: false, error: guard.reason };

  const now = new Date().toISOString();
  return transitionAdjustment(
    ctx,
    "cancelled",
    { cancelled_at: now },
    "cancelled"
  );
}

export async function reopenFinanceAdjustment(
  ctx: LifecycleContext
): Promise<AdjustmentLifecycleResult> {
  const current = await loadAdjustment(ctx.supabase, ctx.kind, ctx.id);
  if (!current) return { ok: false, error: "Adjustment not found." };

  const guard = guardReopenAdjustment(current.status);
  if (!guard.allowed) return { ok: false, error: guard.reason };

  return transitionAdjustment(
    ctx,
    "draft",
    { cancellation_reversed_at: new Date().toISOString(), cancelled_at: null },
    "reopened"
  );
}

export async function unpostFinanceAdjustment(
  ctx: LifecycleContext
): Promise<AdjustmentLifecycleResult> {
  const current = await loadAdjustment(ctx.supabase, ctx.kind, ctx.id);
  if (!current) return { ok: false, error: "Adjustment not found." };

  const guard = guardUnpostAdjustment(current.status);
  if (!guard.allowed) return { ok: false, error: guard.reason };

  const nextStatus = adjustmentUnpostResultStatus();
  return transitionAdjustment(
    ctx,
    nextStatus,
    {
      posted_at: null,
      posting_batch_id: null,
    },
    "unposted"
  );
}
