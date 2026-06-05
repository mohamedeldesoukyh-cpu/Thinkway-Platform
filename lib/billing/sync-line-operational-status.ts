import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import {
  assignmentDeliverableBillingSelect,
  queryAssignmentDeliverables,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deriveLineBillingStatusFromDeliverables,
  type DeliverableBillingRow,
} from "@/lib/billing/deliverable-billing";
import {
  getCampaignLineStatusViolations,
  repairCampaignLineStatusPatch,
} from "@/lib/campaigns/campaign-line-status-invariants";

type LineSnapshot = {
  id: string;
  billing_status: string;
  vendor_io_id: string | null;
  invoice_id: string | null;
  finance_override_until: string | null;
  operational_status: string;
  revenue_locked?: boolean | null;
  vendor_assignment_locked?: boolean | null;
};

function hasActiveFinanceOverride(until: string | null): boolean {
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

function deriveOperationalFromState(input: {
  billingStatus: string;
  vendorIoId: string | null;
  invoiceId: string | null;
  financeOverrideUntil: string | null;
  deliverables: DeliverableBillingRow[];
  storedOperational: string;
}): CampaignLineOperationalStatus {
  const {
    billingStatus,
    vendorIoId,
    invoiceId,
    financeOverrideUntil,
    deliverables,
    storedOperational,
  } = input;

  if (billingStatus === "closed") {
    return "closed";
  }

  const billable = deliverables.reduce((s, d) => s + d.billable_amount, 0);
  const invoiced = deliverables.reduce((s, d) => s + d.invoiced_amount, 0);
  const anyLocked = deliverables.some((d) => d.locked_at);

  if (invoiceId || anyLocked || invoiced > 0) {
    return "locked";
  }

  if (["invoiced", "paid", "partially_invoiced", "partially_paid"].includes(billingStatus)) {
    return "locked";
  }

  if (storedOperational === "io_revised") {
    return "io_revised";
  }

  if (
    !invoiceId &&
    hasActiveFinanceOverride(financeOverrideUntil) &&
    vendorIoId
  ) {
    return "io_generated";
  }

  if (vendorIoId) {
    return "io_generated";
  }

  return "draft";
}

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

/** Coerce invalid DB pairs (e.g. reopened without active finance override). */
function coerceOperationalStatus(
  next: CampaignLineOperationalStatus,
  snapshot: LineSnapshot
): CampaignLineOperationalStatus {
  if (next === "invoiced" || next === "partially_invoiced" || next === "reopened") {
    if (snapshot.invoice_id || snapshot.revenue_locked) return "locked";
    if (snapshot.vendor_io_id && hasActiveFinanceOverride(snapshot.finance_override_until)) {
      return snapshot.operational_status === "io_revised" ? "io_revised" : "io_generated";
    }
    return snapshot.vendor_io_id ? "io_generated" : "draft";
  }
  if (next === "moved_to_billing" && snapshot.vendor_io_id) {
    return "io_generated";
  }
  return next;
}

/** Single source of truth: sync campaign_lines operational + billing from deliverables. */
export async function syncLineOperationalStatus(
  supabase: SupabaseClient,
  lineId: string
): Promise<CampaignLineOperationalStatus> {
  const { data: line, error: lineError } = await supabase
    .from("campaign_lines")
    .select(
      "id, billing_status, vendor_io_id, invoice_id, finance_override_until, operational_status, revenue_locked, vendor_assignment_locked"
    )
    .eq("id", lineId)
    .maybeSingle();

  if (lineError || !line) {
    return "draft";
  }

  const snapshot = line as unknown as LineSnapshot;

  const { data: rows } = await queryAssignmentDeliverables<
    Omit<DeliverableBillingRow, "label">
  >(async (select) => {
    const result = await supabase
      .from("assignment_deliverables")
      .select(select)
      .eq("campaign_line_id", lineId)
      .order("sort_order");
    return {
      data: (result.data ?? null) as Array<Omit<DeliverableBillingRow, "label">> | null,
      error: result.error,
    };
  });

  const deliverables = (rows ?? []) as DeliverableBillingRow[];
  const billingStatus = deriveLineBillingStatusFromDeliverables(
    deliverables,
    snapshot.billing_status
  );

  let nextOperational = coerceOperationalStatus(
    deriveOperationalFromState({
      billingStatus,
      vendorIoId: snapshot.vendor_io_id,
      invoiceId: snapshot.invoice_id,
      financeOverrideUntil: snapshot.finance_override_until,
      deliverables,
      storedOperational: snapshot.operational_status,
    }),
    snapshot
  );

  let patch: Record<string, string | null> = {};
  if (nextOperational !== snapshot.operational_status) {
    patch.operational_status = nextOperational;
  }
  if (billingStatus !== snapshot.billing_status) {
    Object.assign(patch, lineBillingPatch(billingStatus));
  }

  patch = repairCampaignLineStatusPatch(snapshot, patch);

  const violations = getCampaignLineStatusViolations({
    billing_status: String(patch.billing_status ?? snapshot.billing_status),
    operational_status: String(patch.operational_status ?? snapshot.operational_status),
    invoice_id:
      patch.invoice_id !== undefined ? patch.invoice_id : snapshot.invoice_id,
    vendor_io_id: snapshot.vendor_io_id,
    finance_override_until: snapshot.finance_override_until,
  });

  if (violations.length > 0) {
    console.warn("[sync-line-operational-status] invariant repair", {
      lineId,
      violations,
      patch,
    });
  }

  const updateKeys = Object.keys(patch).filter(
    (k) => patch[k] !== undefined && patch[k] !== (snapshot as Record<string, unknown>)[k]
  );

  if (updateKeys.length > 0) {
    const updatePayload = Object.fromEntries(updateKeys.map((k) => [k, patch[k]]));
    await supabase.from("campaign_lines").update(updatePayload as never).eq("id", lineId);
  }

  return nextOperational;
}

export async function syncLineOperationalStatusBatch(
  supabase: SupabaseClient,
  lineIds: Iterable<string>
): Promise<void> {
  for (const lineId of lineIds) {
    await syncLineOperationalStatus(supabase, lineId);
  }
}
