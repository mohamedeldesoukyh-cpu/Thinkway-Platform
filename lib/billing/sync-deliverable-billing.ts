import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import {
  assignmentDeliverableBillingSelect,
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deriveLineBillingStatusFromDeliverables,
  type DeliverableBillingRow,
} from "@/lib/billing/deliverable-billing";

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

type LineRow = {
  id: string;
  campaign_header_id: string;
  document_number: string;
  name: string;
  platform: string | null;
  revenue: number;
  revenue_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_amount: number;
  revenue_after_vat: number;
  revenue_vat_exempt: boolean;
  cost: number;
  cost_before_vat: number;
  cost_vat_percent: number;
  cost_vat_amount: number;
  cost_after_vat: number;
  cost_vat_exempt: boolean;
  billing_status: string;
  pricing_mode?: string | null;
};

/** Ensures every billable line has at least one assignment_deliverables row. */
export async function ensureBillableDeliverablesForLine(
  supabase: SupabaseClient,
  line: LineRow
): Promise<void> {
  const { count } = await supabase
    .from("assignment_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("campaign_line_id", line.id);

  if ((count ?? 0) > 0) return;

  const revenueBeforeVat = Number(line.revenue_before_vat ?? line.revenue);
  const costBeforeVat = Number(line.cost_before_vat ?? line.cost);

  await supabase.from("assignment_deliverables").insert({
    campaign_header_id: line.campaign_header_id,
    campaign_line_id: line.id,
    sort_order: 0,
    platform: line.platform ?? "other",
    deliverable_type: "other",
    quantity: 1,
    unit_cost: costBeforeVat,
    total_cost: costBeforeVat,
    revenue_before_vat: revenueBeforeVat,
    revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
    revenue_vat_amount: Number(line.revenue_vat_amount ?? 0),
    revenue_after_vat: Number(line.revenue_after_vat ?? line.revenue),
    revenue_vat_exempt: line.revenue_vat_exempt ?? false,
    cost_before_vat: costBeforeVat,
    cost_vat_percent: Number(line.cost_vat_percent ?? 0),
    cost_vat_amount: Number(line.cost_vat_amount ?? 0),
    cost_after_vat: Number(line.cost_after_vat ?? line.cost),
    cost_vat_exempt: line.cost_vat_exempt ?? false,
    billable_amount: revenueBeforeVat,
    remaining_amount: revenueBeforeVat,
    billing_status:
      line.billing_status === "moved_to_billing" ||
      line.billing_status === "approved"
        ? "ready_to_invoice"
        : "draft",
    schedule_mode: "single",
    metadata: { legacy_synthetic: true },
  });
}

export async function markDeliverablesReadyToInvoice(
  supabase: SupabaseClient,
  lineId: string
): Promise<void> {
  await supabase
    .from("assignment_deliverables")
    .update({ billing_status: "ready_to_invoice" })
    .eq("campaign_line_id", lineId)
    .in("billing_status", ["draft"]);
}

export async function syncLineBillingFromDeliverables(
  supabase: SupabaseClient,
  lineId: string,
  currentLineStatus: string
): Promise<void> {
  const { data: rows, includesVatExempt } = await queryAssignmentDeliverables<
    Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
  >(async (select) => {
    const result = await supabase
      .from("assignment_deliverables")
      .select(select)
      .eq("campaign_line_id", lineId)
      .order("sort_order");
    return {
      data: (result.data ?? null) as Array<
        Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
      > | null,
      error: result.error,
    };
  });

  const deliverables = (rows ?? []).map((row) => ({
    ...row,
    revenue_vat_exempt: resolveDeliverableVatExempt(row, includesVatExempt),
  })) as DeliverableBillingRow[];
  const nextStatus = deriveLineBillingStatusFromDeliverables(
    deliverables,
    currentLineStatus
  );

  const fullLock = deliverables.length > 0 && deliverables.every((d) => d.locked_at);
  const partialLock = deliverables.some((d) => d.locked_at);

  await supabase
    .from("campaign_lines")
    .update({
      ...lineBillingPatch(nextStatus),
      revenue_locked: fullLock,
      vat_locked: partialLock || fullLock,
    })
    .eq("id", lineId);
}

export async function unlockDeliverablesForInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<string[]> {
  const { data: items } = await supabase
    .from("invoice_line_items")
    .select("assignment_deliverable_id, campaign_line_id")
    .eq("invoice_id", invoiceId);

  const deliverableIds = (items ?? [])
    .map((i) => i.assignment_deliverable_id)
    .filter(Boolean) as string[];

  const lineIds = [
    ...new Set(
      (items ?? [])
        .map((i) => i.campaign_line_id)
        .filter(Boolean) as string[]
    ),
  ];

  if (deliverableIds.length > 0) {
    await supabase
      .from("assignment_deliverables")
      .update({
        billing_status: "ready_to_invoice",
        invoice_line_item_id: null,
        invoiced_amount: 0,
        invoiced_at: null,
        locked_at: null,
      })
      .in("id", deliverableIds);
  }

  return lineIds;
}
