import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";
import {
  getCampaignLineStatusViolations,
  isCampaignLineStatusValid,
} from "@/lib/campaigns/campaign-line-status-invariants";
import { logReviseVendorIo } from "@/lib/io/revise-vendor-io-log";

const STALE_LINE_BILLING = new Set([
  "invoiced",
  "partially_invoiced",
  "paid",
  "partially_paid",
]);

const STALE_DELIVERABLE_BILLING = new Set([
  "invoiced",
  "partially_invoiced",
  "partially_collected",
  "collected",
]);

/**
 * After Vendor IO revision, line must not stay reopened+invoiced with locked deliverable children.
 * Clears header invoice linkage, unlocks deliverables, then syncs line + operational status.
 */
export async function finalizeLineBillingAfterVendorIoRevision(
  supabase: SupabaseClient,
  lineId: string
): Promise<void> {
  const { data: line, error: lineError } = await supabase
    .from("campaign_lines")
    .select("id, billing_status, invoice_id, vendor_io_id, operational_status")
    .eq("id", lineId)
    .maybeSingle();

  if (lineError || !line) {
    logReviseVendorIo("billing_finalize_line_missing", { lineId, message: lineError?.message });
    return;
  }

  const snapshot = line as {
    id: string;
    billing_status: string;
    invoice_id: string | null;
    vendor_io_id: string | null;
    operational_status: string;
  };

  const { data: deliverables, error: delError } = await supabase
    .from("assignment_deliverables")
    .select(
      "id, billable_amount, revenue_before_vat, billing_status, locked_at, invoiced_amount, invoice_line_item_id"
    )
    .eq("campaign_line_id", lineId);

  if (delError) {
    logReviseVendorIo("billing_finalize_deliverables_failed", {
      lineId,
      message: delError.message,
    });
  }

  let resetCount = 0;
  for (const row of deliverables ?? []) {
    const d = row as {
      id: string;
      billable_amount: number | null;
      revenue_before_vat: number | null;
      billing_status: string;
      locked_at: string | null;
      invoiced_amount: number | null;
      invoice_line_item_id: string | null;
    };

    const billable = Number(d.billable_amount ?? d.revenue_before_vat ?? 0);
    const needsReset =
      Boolean(d.locked_at) ||
      Boolean(d.invoice_line_item_id) ||
      Number(d.invoiced_amount) > 0 ||
      STALE_DELIVERABLE_BILLING.has(d.billing_status);

    if (!needsReset) continue;

    const { error: resetError } = await supabase
      .from("assignment_deliverables")
      .update({
        billing_status: "ready_to_invoice",
        invoice_line_item_id: null,
        invoiced_amount: 0,
        invoiced_at: null,
        locked_at: null,
        remaining_amount: billable,
      } as never)
      .eq("id", d.id);

    if (resetError) {
      logReviseVendorIo("billing_finalize_deliverable_reset_failed", {
        lineId,
        deliverableId: d.id,
        message: resetError.message,
      });
      continue;
    }
    resetCount += 1;
  }

  const postReset = await supabase
    .from("assignment_post_schedule")
    .update({ billing_status: "ready_to_invoice" } as never)
    .eq("campaign_line_id", lineId);

  if (postReset.error) {
    logReviseVendorIo("billing_finalize_posts_skipped", {
      lineId,
      message: postReset.error.message,
    });
  }

  await supabase
    .from("campaign_lines")
    .update({
      invoice_id: null,
      finance_override_until: null,
      revenue_locked: false,
      cost_locked: false,
      vendor_assignment_locked: false,
      vat_locked: false,
    } as never)
    .eq("id", lineId);

  const billingFallback = snapshot.vendor_io_id
    ? "moved_to_billing"
    : ["approved", "moved_to_billing"].includes(snapshot.billing_status)
      ? snapshot.billing_status
      : "approved";

  const lineFallback = STALE_LINE_BILLING.has(snapshot.billing_status)
    ? billingFallback
    : snapshot.billing_status;

  await syncLineBillingFromDeliverables(supabase, lineId, lineFallback);

  const { data: after } = await supabase
    .from("campaign_lines")
    .select("operational_status, billing_status, vendor_io_id, invoice_id")
    .eq("id", lineId)
    .maybeSingle();

  const afterSnap = after as {
    operational_status: string;
    billing_status: string;
    vendor_io_id: string | null;
    invoice_id: string | null;
  } | null;

  const violations = afterSnap ? getCampaignLineStatusViolations(afterSnap) : ["missing line"];

  logReviseVendorIo("billing_finalize_complete", {
    lineId,
    resetDeliverables: resetCount,
    valid: afterSnap ? isCampaignLineStatusValid(afterSnap) : false,
    violations: violations.length > 0 ? violations : undefined,
    before: {
      operational_status: snapshot.operational_status,
      billing_status: snapshot.billing_status,
      invoice_id: snapshot.invoice_id,
    },
    after: afterSnap,
  });

  if (afterSnap && violations.length > 0) {
    logReviseVendorIo("billing_finalize_invariant_failed", { lineId, violations });
  }
}

export async function finalizeLineBillingAfterVendorIoRevisionBatch(
  supabase: SupabaseClient,
  lineIds: Iterable<string>
): Promise<void> {
  for (const lineId of lineIds) {
    await finalizeLineBillingAfterVendorIoRevision(supabase, lineId);
  }
}
