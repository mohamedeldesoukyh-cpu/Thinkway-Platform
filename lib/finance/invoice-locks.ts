import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLineOperationalStatusBatch } from "@/lib/billing/sync-line-operational-status";
import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import { ensureInvoiceFinanceDocument } from "@/lib/finance/finance-document-registry";
import type { InvoiceStatus } from "@/lib/finance/status/invoice-status";

/** Invoice statuses that trigger operational + billing locks. */
export const INVOICE_LOCK_STATUSES: readonly InvoiceStatus[] = [
  "sent",
  "partial",
  "paid",
] as const;

const LOCK_STATUS_SET = new Set<string>([...INVOICE_LOCK_STATUSES, "draft"]);

export function shouldLockInvoiceOperationalState(status: string): boolean {
  return INVOICE_LOCK_STATUSES.includes(status as InvoiceStatus);
}

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

async function resolveInvoiceLineIds(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<string[]> {
  const lineIds = new Set<string>();

  const { data: linkedLines } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("invoice_id", invoiceId);

  for (const row of linkedLines ?? []) {
    lineIds.add((row as { id: string }).id);
  }

  const { data: items } = await supabase
    .from("invoice_line_items")
    .select(
      "campaign_line_id, assignment_deliverable_id, assignment_post_schedule_id"
    )
    .eq("invoice_id", invoiceId);

  const postIds = new Set<string>();
  const deliverableIds = new Set<string>();

  for (const item of items ?? []) {
    const row = item as {
      campaign_line_id: string | null;
      assignment_deliverable_id: string | null;
      assignment_post_schedule_id: string | null;
    };
    if (row.campaign_line_id) lineIds.add(row.campaign_line_id);
    if (row.assignment_post_schedule_id) postIds.add(row.assignment_post_schedule_id);
    if (row.assignment_deliverable_id) deliverableIds.add(row.assignment_deliverable_id);
  }

  if (postIds.size > 0) {
    const { data: posts } = await supabase
      .from("assignment_post_schedule")
      .select("campaign_line_id")
      .in("id", [...postIds]);

    for (const post of posts ?? []) {
      const lineId = (post as { campaign_line_id: string | null }).campaign_line_id;
      if (lineId) lineIds.add(lineId);
    }
  }

  if (deliverableIds.size > 0) {
    const { data: deliverables } = await supabase
      .from("assignment_deliverables")
      .select("campaign_line_id")
      .in("id", [...deliverableIds]);

    for (const deliverable of deliverables ?? []) {
      const lineId = (deliverable as { campaign_line_id: string | null }).campaign_line_id;
      if (lineId) lineIds.add(lineId);
    }
  }

  return [...lineIds];
}

/** Lock assignments, deliverables, pricing, and IO editing for an invoiced state. */
export async function lockInvoiceAssignments(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: { billingStatus?: string }
): Promise<{ lineIds: string[]; error?: string }> {
  const lineIds = await resolveInvoiceLineIds(supabase, invoiceId);
  if (lineIds.length === 0) {
    return { lineIds: [] };
  }

  const now = new Date().toISOString();
  const billingStatus = options?.billingStatus ?? "invoiced";

  const { error: lineError } = await supabase
    .from("campaign_lines")
    .update({
      ...lineBillingPatch(billingStatus),
      operational_status: "locked",
      revenue_locked: true,
      cost_locked: true,
      vendor_assignment_locked: true,
      vat_locked: true,
      invoice_id: invoiceId,
      billing_invoiced_at: now,
      finance_override_until: null,
    } as never)
    .in("id", lineIds);

  if (lineError) {
    return { lineIds, error: lineError.message };
  }

  const { data: deliverableIds } = await supabase
    .from("invoice_line_items")
    .select("assignment_deliverable_id")
    .eq("invoice_id", invoiceId)
    .not("assignment_deliverable_id", "is", null);

  const ids = (deliverableIds ?? [])
    .map((d) => (d as { assignment_deliverable_id: string }).assignment_deliverable_id)
    .filter(Boolean);

  if (ids.length > 0) {
    await supabase
      .from("assignment_deliverables")
      .update({ locked_at: now })
      .in("id", ids)
      .is("locked_at", null);
  }

  await syncLineOperationalStatusBatch(supabase, lineIds);

  await supabase
    .from("invoices")
    .update({ is_operational_locked: true } as never)
    .eq("id", invoiceId);

  return { lineIds };
}

/** Unlock assignments after unpost or void. */
export async function unlockInvoiceAssignments(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: { financeOverrideHours?: number }
): Promise<{ lineIds: string[]; error?: string }> {
  const { unlockDeliverablesForInvoice } = await import(
    "@/lib/billing/sync-deliverable-billing"
  );

  const lineIdsFromInvoice = await resolveInvoiceLineIds(supabase, invoiceId);
  const unlockedLineIds = await unlockDeliverablesForInvoice(supabase, invoiceId);
  const affectedLineIds = [...new Set([...lineIdsFromInvoice, ...unlockedLineIds])];

  if (affectedLineIds.length === 0) {
    await supabase
      .from("invoices")
      .update({ is_operational_locked: false } as never)
      .eq("id", invoiceId);
    return { lineIds: [] };
  }

  const overrideHours = options?.financeOverrideHours ?? 72;
  const overrideUntil = new Date(Date.now() + overrideHours * 3600000).toISOString();

  for (const lineId of affectedLineIds) {
    const { data: lineDeliverables } = await supabase
      .from("assignment_deliverables")
      .select("locked_at")
      .eq("campaign_line_id", lineId);

    const anyLocked = (lineDeliverables ?? []).some((d) => d.locked_at);
    const allLocked =
      (lineDeliverables ?? []).length > 0 &&
      (lineDeliverables ?? []).every((d) => d.locked_at);

    await supabase
      .from("campaign_lines")
      .update({
        revenue_locked: allLocked,
        cost_locked: allLocked,
        vendor_assignment_locked: allLocked,
        vat_locked: anyLocked,
        finance_override_until: overrideUntil,
        invoice_id: null,
        operational_status: "io_generated",
        billing_status: "moved_to_billing",
      } as never)
      .eq("id", lineId);
  }

  await syncLineOperationalStatusBatch(supabase, affectedLineIds);

  await supabase
    .from("invoices")
    .update({ is_operational_locked: false } as never)
    .eq("id", invoiceId);

  return { lineIds: affectedLineIds };
}

/** Sync OPS + billing when invoice status changes. */
export async function syncInvoiceOperationalStates(
  supabase: SupabaseClient,
  invoiceId: string,
  status: string,
  actorId?: string | null
): Promise<void> {
  await ensureInvoiceFinanceDocument(supabase, invoiceId, actorId);

  if (shouldLockInvoiceOperationalState(status) || LOCK_STATUS_SET.has(status)) {
    const billingStatus =
      status === "paid"
        ? "paid"
        : status === "partial"
          ? "partially_paid"
          : "invoiced";
    await lockInvoiceAssignments(supabase, invoiceId, { billingStatus });
    return;
  }

  if (status === "void" || status === "draft") {
    await unlockInvoiceAssignments(supabase, invoiceId);
  }
}
