import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deliverableDisplayLabel,
  isDeliverableInvoiceEligible,
  rollupAssignmentBilling,
} from "@/lib/billing/deliverable-billing";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import { deliverableLabel } from "@/features/campaigns/line-assignment";
import { getCampaignWorkspace } from "@/features/campaigns/queries";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentHierarchy,
  AssignmentHierarchyGroup,
  AssignmentHierarchyRollups,
  AssignmentScheduleChip,
  DeliverableCollectionStatus,
} from "@/features/campaigns/types/assignment-hierarchy";
import { formatMarginPercent } from "@/features/billing/types";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return { supabase, user };
}

function deriveCollectionStatus(
  billingStatus: AssignmentDeliverableBillingStatus
): DeliverableCollectionStatus {
  if (billingStatus === "collected") return "collected";
  if (billingStatus === "partially_collected") return "partial";
  if (billingStatus === "invoiced") return "pending";
  return null;
}

function deriveWorkflowStatus(
  schedules: AssignmentScheduleChip[],
  billingStatus: AssignmentDeliverableBillingStatus
): string {
  if (schedules.length === 0) {
    if (billingStatus === "invoiced" || billingStatus === "collected") return "posted";
    return "draft";
  }
  const priority = [
    "verified",
    "posted",
    "approved",
    "awaiting_approval",
    "scheduled",
    "draft",
    "cancelled",
  ];
  for (const status of priority) {
    if (schedules.some((s) => s.status === status)) return status;
  }
  return schedules[0]?.status ?? "draft";
}

function buildSyntheticDeliverable(
  line: AssignmentHierarchyGroup["line"]
): AssignmentDeliverableHierarchyRow {
  const billingStatus: AssignmentDeliverableBillingStatus =
    line.billing_status === "invoiced" ||
    line.billing_status === "paid" ||
    line.billing_status === "closed"
      ? "invoiced"
      : line.billing_status === "partially_invoiced"
        ? "partially_invoiced"
        : ["moved_to_billing", "approved"].includes(line.billing_status)
          ? "ready_to_invoice"
          : "draft";

  const revenueBeforeVat = line.revenue_before_vat;
  const invoiced =
    billingStatus === "invoiced" || billingStatus === "partially_invoiced"
      ? revenueBeforeVat
      : 0;

  return {
    id: `synthetic-${line.id}`,
    campaign_line_id: line.id,
    sort_order: 0,
    label: `${line.influencer_name ?? line.name} — Package`,
    platform: line.platform ?? "other",
    deliverable_type: "other",
    deliverable_type_label: "Package",
    quantity: line.deliverable_count || 1,
    unit_cost: line.cost_before_vat / Math.max(1, line.deliverable_count || 1),
    unit_revenue: line.revenue_before_vat / Math.max(1, line.deliverable_count || 1),
    live_date: line.start_date,
    notes: null,
    revenue_before_vat: revenueBeforeVat,
    cost_before_vat: line.cost_before_vat,
    revenue_vat_percent: line.revenue_vat_percent,
    revenue_vat_amount: line.revenue_vat_amount,
    revenue_after_vat: line.revenue_after_vat,
    cost_vat_amount: line.cost_vat_amount,
    billing_status: billingStatus,
    collection_status: deriveCollectionStatus(billingStatus),
    invoice_id: line.invoice_id,
    invoice_document_number: null,
    payout_status: line.vendor_payment_status,
    workflow_status: line.assignment_status,
    schedules: [],
    remaining_amount: Math.max(0, revenueBeforeVat - invoiced),
    invoiced_amount: invoiced,
    invoice_eligible: isDeliverableInvoiceEligible(
      {
        id: `synthetic-${line.id}`,
        campaign_line_id: line.id,
        sort_order: 0,
        platform: line.platform ?? "other",
        deliverable_type: "other",
        quantity: 1,
        live_date: line.start_date,
        billable_amount: revenueBeforeVat,
        invoiced_amount: invoiced,
        collected_amount: 0,
        disputed_amount: 0,
        remaining_amount: Math.max(0, revenueBeforeVat - invoiced),
        billing_status: billingStatus,
        invoice_line_item_id: null,
        locked_at: null,
        revenue_before_vat: revenueBeforeVat,
        revenue_vat_percent: line.revenue_vat_percent,
        revenue_vat_exempt: line.revenue_vat_exempt,
        label: "Package",
      },
      line.billing_status
    ),
    is_synthetic: true,
    is_locked: line.revenue_locked ?? false,
  };
}

function buildRollups(
  deliverables: AssignmentDeliverableHierarchyRow[],
  line: AssignmentHierarchyGroup["line"]
): AssignmentHierarchyRollups {
  if (deliverables.every((d) => d.is_synthetic)) {
    return {
      deliverable_count: line.deliverable_count || 1,
      revenue: line.revenue,
      cost: line.cost,
      gp: line.gp,
      margin_percent: line.margin_percent,
      invoiced_value: deliverables[0]?.invoiced_amount ?? 0,
      remaining_value: deliverables[0]?.remaining_amount ?? line.revenue_before_vat,
      collected_value: 0,
    };
  }

  const revenue = deliverables.reduce((s, d) => s + d.revenue_before_vat, 0);
  const cost = deliverables.reduce((s, d) => s + d.cost_before_vat, 0);
  const gp = revenue - cost;
  const billingRollup = rollupAssignmentBilling(
    deliverables.map((d) => ({
      id: d.id,
      campaign_line_id: d.campaign_line_id,
      sort_order: 0,
      platform: d.platform,
      deliverable_type: d.deliverable_type,
      quantity: d.quantity,
      live_date: d.live_date,
      billable_amount: d.revenue_before_vat,
      invoiced_amount: d.invoiced_amount,
      collected_amount: 0,
      disputed_amount: 0,
      remaining_amount: d.remaining_amount,
      billing_status: d.billing_status,
      invoice_line_item_id: null,
      locked_at: null,
      revenue_before_vat: d.revenue_before_vat,
      revenue_vat_percent: 0,
      revenue_vat_exempt: false,
      label: d.label,
    }))
  );

  return {
    deliverable_count: deliverables.length,
    revenue,
    cost,
    gp,
    margin_percent: formatMarginPercent(revenue, gp),
    invoiced_value: billingRollup.invoiced_value,
    remaining_value: billingRollup.remaining_value,
    collected_value: billingRollup.collected_value,
  };
}

export async function getCampaignAssignmentHierarchy(
  campaignId: string
): Promise<AssignmentHierarchy> {
  const workspace = await getCampaignWorkspace(campaignId);
  if (!workspace) {
    return { groups: [], currency_code: "USD" };
  }
  const { supabase } = await requireUser();

  const lineIds = workspace.lines.map((l) => l.id);
  if (lineIds.length === 0) {
    return { groups: [], currency_code: workspace.currency_code };
  }

  const { data: deliverableRows, includesVatExempt } =
    await queryAssignmentDeliverables<{
      id: string;
      campaign_line_id: string;
      sort_order: number;
      platform: string;
      deliverable_type: string;
      quantity: number;
      live_date: string | null;
      billable_amount: number;
      invoiced_amount: number;
      collected_amount: number;
      remaining_amount: number;
      billing_status: AssignmentDeliverableBillingStatus;
      invoice_line_item_id: string | null;
      revenue_before_vat: number;
      unit_cost: number;
      cost_before_vat: number;
      cost_vat_amount: number;
      revenue_vat_percent: number;
      revenue_vat_amount: number;
      revenue_after_vat: number;
      notes: string | null;
      locked_at: string | null;
      revenue_vat_exempt?: boolean | null;
    }>(async (select, _includeVatExempt) => {
      const result = await supabase
        .from("assignment_deliverables")
        .select(select)
        .in("campaign_line_id", lineIds)
        .order("sort_order");
      return {
        data: (result.data ?? null) as Array<{
          id: string;
          campaign_line_id: string;
          sort_order: number;
          platform: string;
          deliverable_type: string;
          quantity: number;
          live_date: string | null;
          billable_amount: number;
          invoiced_amount: number;
          collected_amount: number;
          remaining_amount: number;
          billing_status: AssignmentDeliverableBillingStatus;
          invoice_line_item_id: string | null;
          revenue_before_vat: number;
          cost_before_vat: number;
          cost_vat_amount: number;
          revenue_vat_percent: number;
          unit_cost: number;
          notes: string | null;
          locked_at: string | null;
          revenue_vat_amount: number;
          revenue_after_vat: number;
          revenue_vat_exempt?: boolean | null;
        }> | null,
        error: result.error,
      };
    });

  const deliverableIds = (deliverableRows ?? []).map((d) => d.id);

  const [schedulesResult, invoiceItemsResult] = await Promise.all([
    supabase
      .from("assignment_post_schedule")
      .select("id, assignment_deliverable_id, sequence_number, live_date, status")
      .in("campaign_line_id", lineIds)
      .order("sequence_number"),
    deliverableIds.length > 0
      ? supabase
          .from("invoice_line_items")
          .select("assignment_deliverable_id, invoice_id")
          .in("assignment_deliverable_id", deliverableIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (schedulesResult.error) throw new Error(schedulesResult.error.message);
  if (invoiceItemsResult.error) throw new Error(invoiceItemsResult.error.message);

  const invoiceIds = [
    ...new Set(
      (invoiceItemsResult.data ?? [])
        .map((i) => i.invoice_id)
        .filter(Boolean) as string[]
    ),
  ];

  const { data: invoiceRows } =
    invoiceIds.length > 0
      ? await supabase
          .from("invoices")
          .select("id, document_number")
          .in("id", invoiceIds)
      : { data: [] };

  const invoiceDocById = new Map(
    (invoiceRows ?? []).map((inv) => [inv.id, inv.document_number])
  );

  const schedulesByDeliverable = new Map<string, AssignmentScheduleChip[]>();
  for (const row of schedulesResult.data ?? []) {
    const list = schedulesByDeliverable.get(row.assignment_deliverable_id) ?? [];
    list.push({
      id: row.id,
      sequence_number: row.sequence_number,
      live_date: row.live_date,
      status: row.status,
    });
    schedulesByDeliverable.set(row.assignment_deliverable_id, list);
  }

  const invoiceByDeliverable = new Map<
    string,
    { invoice_id: string; document_number: string }
  >();
  for (const item of invoiceItemsResult.data ?? []) {
    if (!item.assignment_deliverable_id || !item.invoice_id) continue;
    const documentNumber = invoiceDocById.get(item.invoice_id);
    if (documentNumber) {
      invoiceByDeliverable.set(item.assignment_deliverable_id, {
        invoice_id: item.invoice_id,
        document_number: documentNumber,
      });
    }
  }

  const deliverablesByLine = new Map<string, AssignmentDeliverableHierarchyRow[]>();

  for (const row of deliverableRows ?? []) {
    const schedules = schedulesByDeliverable.get(row.id) ?? [];
    const invoiceLink = invoiceByDeliverable.get(row.id);
    const billingStatus = row.billing_status;
    const label = deliverableDisplayLabel({
      platform: row.platform,
      deliverable_type: row.deliverable_type,
      sort_order: row.sort_order,
      quantity: row.quantity,
    });

    const line = workspace.lines.find((l) => l.id === row.campaign_line_id);
    const qty = Math.max(1, row.quantity);
    const mapped: AssignmentDeliverableHierarchyRow = {
      id: row.id,
      campaign_line_id: row.campaign_line_id,
      sort_order: row.sort_order,
      label,
      platform: row.platform,
      deliverable_type: row.deliverable_type,
      deliverable_type_label: deliverableLabel(row.deliverable_type),
      quantity: row.quantity,
      unit_cost: Number(row.unit_cost ?? 0),
      unit_revenue: Number(row.revenue_before_vat) / qty,
      live_date: row.live_date ?? schedules[0]?.live_date ?? null,
      notes: row.notes ?? null,
      revenue_before_vat: Number(row.revenue_before_vat),
      cost_before_vat: Number(row.cost_before_vat ?? 0),
      revenue_vat_percent: Number(row.revenue_vat_percent ?? 0),
      revenue_vat_amount: Number(row.revenue_vat_amount ?? 0),
      revenue_after_vat: Number(row.revenue_after_vat ?? row.revenue_before_vat),
      cost_vat_amount: Number(row.cost_vat_amount ?? 0),
      billing_status: billingStatus,
      collection_status: deriveCollectionStatus(billingStatus),
      invoice_id: invoiceLink?.invoice_id ?? null,
      invoice_document_number: invoiceLink?.document_number ?? null,
      payout_status: line?.vendor_payment_status ?? null,
      workflow_status: deriveWorkflowStatus(schedules, billingStatus),
      schedules,
      remaining_amount: Number(row.remaining_amount),
      invoiced_amount: Number(row.invoiced_amount),
      invoice_eligible: isDeliverableInvoiceEligible(
        {
          id: row.id,
          campaign_line_id: row.campaign_line_id,
          sort_order: row.sort_order,
          platform: row.platform,
          deliverable_type: row.deliverable_type,
          quantity: row.quantity,
          live_date: row.live_date,
          billable_amount: Number(row.billable_amount),
          invoiced_amount: Number(row.invoiced_amount),
          collected_amount: Number(row.collected_amount),
          disputed_amount: 0,
          remaining_amount: Number(row.remaining_amount),
          billing_status: billingStatus,
          invoice_line_item_id: row.invoice_line_item_id,
          locked_at: null,
          revenue_before_vat: Number(row.revenue_before_vat),
          revenue_vat_percent: 0,
          revenue_vat_exempt: resolveDeliverableVatExempt(row, includesVatExempt),
          label,
        },
        line?.billing_status ?? "draft"
      ),
      is_synthetic: false,
      is_locked: Boolean(row.locked_at),
    };

    const list = deliverablesByLine.get(row.campaign_line_id) ?? [];
    list.push(mapped);
    deliverablesByLine.set(row.campaign_line_id, list);
  }

  const groups: AssignmentHierarchyGroup[] = workspace.lines.map((line) => {
    let deliverables = deliverablesByLine.get(line.id) ?? [];
    if (deliverables.length === 0) {
      deliverables = [buildSyntheticDeliverable(line)];
    }
    return {
      line,
      deliverables,
      rollups: buildRollups(deliverables, line),
    };
  });

  return {
    groups,
    currency_code: workspace.currency_code,
  };
}
