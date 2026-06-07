import type { SupabaseClient } from "@supabase/supabase-js";

import { syncPostScheduleOnDeliverableInvoiceLock } from "@/lib/billing/sync-post-invoice-lock";
import { shouldApplyLiveAdDateLockOnInvoice } from "@/lib/campaigns/live-ad-date";

/** After live ad date is saved on an invoiced row, close the date lock. */
export async function applyLiveAdDateLockAfterDateInsert(
  supabase: SupabaseClient,
  deliverableId: string,
  liveDate: string | null
): Promise<{ error?: string }> {
  if (!shouldApplyLiveAdDateLockOnInvoice(liveDate)) {
    return {};
  }

  const { data: deliverable, error: loadError } = await supabase
    .from("assignment_deliverables")
    .select("id, invoice_line_item_id, locked_at, revenue_before_vat, billable_amount")
    .eq("id", deliverableId)
    .maybeSingle();

  if (loadError || !deliverable) {
    return { error: loadError?.message ?? "Deliverable not found." };
  }

  const row = deliverable as {
    id: string;
    invoice_line_item_id: string | null;
    locked_at: string | null;
    revenue_before_vat: number | null;
    billable_amount: number | null;
  };

  if (!row.invoice_line_item_id || row.locked_at) {
    return {};
  }

  const now = new Date().toISOString();
  const { error: lockError } = await supabase
    .from("assignment_deliverables")
    .update({
      live_date: liveDate,
      locked_at: now,
    })
    .eq("id", deliverableId);

  if (lockError) {
    return { error: lockError.message };
  }

  return syncPostScheduleOnDeliverableInvoiceLock(supabase, {
    deliverableId,
    invoiceLineItemId: row.invoice_line_item_id,
    lockedAt: now,
    deliverableBillable: Number(row.billable_amount ?? row.revenue_before_vat ?? 0),
    lockSchedule: true,
  });
}
