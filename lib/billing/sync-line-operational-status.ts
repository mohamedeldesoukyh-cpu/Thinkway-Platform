import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import {
  assignmentDeliverableBillingSelect,
  queryAssignmentDeliverables,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deriveLineBillingStatusFromDeliverables,
  type DeliverableBillingRow,
} from "@/lib/billing/deliverable-billing";

type LineSnapshot = {
  id: string;
  billing_status: string;
  vendor_io_id: string | null;
  invoice_id: string | null;
  finance_override_until: string | null;
  operational_status: string;
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
}): CampaignLineOperationalStatus {
  const { billingStatus, vendorIoId, invoiceId, financeOverrideUntil, deliverables } =
    input;

  if (billingStatus === "closed") {
    return "closed";
  }

  if (billingStatus === "paid" && deliverables.length > 0) {
    const billable = deliverables.reduce((s, d) => s + d.billable_amount, 0);
    const collected = deliverables.reduce((s, d) => s + d.collected_amount, 0);
    if (billable > 0 && collected >= billable) {
      return "closed";
    }
  }

  const billable = deliverables.reduce((s, d) => s + d.billable_amount, 0);
  const invoiced = deliverables.reduce((s, d) => s + d.invoiced_amount, 0);
  const anyLocked = deliverables.some((d) => d.locked_at);

  if (billable > 0 && invoiced >= billable && anyLocked) {
    return "invoiced";
  }
  if (invoiced > 0 && invoiced < billable) {
    return "partially_invoiced";
  }

  if (
    !invoiceId &&
    hasActiveFinanceOverride(financeOverrideUntil) &&
    ["moved_to_billing", "approved", "partially_invoiced", "invoiced"].includes(
      billingStatus
    )
  ) {
    return "reopened";
  }

  if (invoiceId) {
    return invoiced > 0 && invoiced < billable ? "partially_invoiced" : "invoiced";
  }

  if (vendorIoId && ["moved_to_billing", "approved"].includes(billingStatus)) {
    return "moved_to_billing";
  }

  if (vendorIoId) {
    return "io_generated";
  }

  return "draft";
}

/** Single source of truth: sync campaign_lines.operational_status from billing + deliverable locks. */
export async function syncLineOperationalStatus(
  supabase: SupabaseClient,
  lineId: string
): Promise<CampaignLineOperationalStatus> {
  const { data: line, error: lineError } = await supabase
    .from("campaign_lines")
    .select(
      "id, billing_status, vendor_io_id, invoice_id, finance_override_until, operational_status"
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

  const nextOperational = deriveOperationalFromState({
    billingStatus,
    vendorIoId: snapshot.vendor_io_id,
    invoiceId: snapshot.invoice_id,
    financeOverrideUntil: snapshot.finance_override_until,
    deliverables,
  });

  if (nextOperational !== snapshot.operational_status) {
    await supabase
      .from("campaign_lines")
      .update({ operational_status: nextOperational } as never)
      .eq("id", lineId);
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
