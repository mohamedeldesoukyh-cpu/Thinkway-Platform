import { requireRequestUser, type RequestUser } from "@/lib/supabase/server";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import {
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deliverableDisplayLabel,
  isDeliverableInvoiceEligible,
} from "@/lib/billing/deliverable-billing";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import { deliverableLabel } from "@/features/campaigns/line-assignment";
import { getCampaignWorkspace } from "@/features/campaigns/queries";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentHierarchy,
  AssignmentHierarchyBillingContext,
  AssignmentHierarchyGroup,
  AssignmentPostOperationalRow,
  DeliverableCollectionStatus,
} from "@/features/campaigns/types/assignment-hierarchy";
import { formatDeliverableHierarchyLabel } from "@/lib/campaigns/deliverable-display-label";
import { deliverableTypeLabel } from "@/lib/campaigns/deliverable-taxonomy";
import {
  isDeliverableCommercialLocked,
  isLiveAdDateLocked,
} from "@/lib/campaigns/live-ad-date";
import { isLineInvoiceEligible } from "@/lib/billing/line-invoice-eligibility";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import { logRevisionHierarchyKeys } from "@/lib/campaigns/assignment-row-debug";
import { sanitizeAssignmentHierarchy } from "@/lib/campaigns/sanitize-assignment-hierarchy";
import {
  alignPackageLineCommercialToDeliverables,
  buildAssignmentHierarchyRollups,
} from "@/lib/campaigns/assignment-hierarchy-rollups";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";

function lineAllowsDeliverableInvoice(line: CampaignLineWorkspace): boolean {
  return isLineInvoiceEligible({
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
  });
}


const POST_SCHEDULE_OPERATIONAL_SELECT =
  "id, assignment_deliverable_id, sequence_number, live_date, status, notes, metadata, revenue_before_vat, cost_before_vat, revenue_vat_percent, revenue_vat_amount, cost_vat_amount, billing_status";

const POST_SCHEDULE_LEGACY_SELECT =
  "id, assignment_deliverable_id, sequence_number, live_date, status, notes, metadata";

async function queryPostSchedulesForLines(
  supabase: RequestUser["supabase"],
  lineIds: string[]
) {
  const operational = await supabase
    .from("assignment_post_schedule")
    .select(POST_SCHEDULE_OPERATIONAL_SELECT)
    .in("campaign_line_id", lineIds)
    .order("sequence_number");

  if (!operational.error) {
    return { data: operational.data ?? [], error: null as string | null, operational: true };
  }

  console.warn("[assignment-hierarchy] operational post schedule select failed, falling back", {
    message: operational.error.message,
    lineCount: lineIds.length,
  });

  const legacy = await supabase
    .from("assignment_post_schedule")
    .select(POST_SCHEDULE_LEGACY_SELECT)
    .in("campaign_line_id", lineIds)
    .order("sequence_number");

  if (legacy.error) {
    console.error("[assignment-hierarchy] legacy post schedule select failed", {
      message: legacy.error.message,
    });
    return { data: [], error: legacy.error.message, operational: false };
  }

  return { data: legacy.data ?? [], error: null, operational: false };
}

function deriveCollectionStatus(
  billingStatus: AssignmentDeliverableBillingStatus
): DeliverableCollectionStatus {
  if (billingStatus === "collected") return "collected";
  if (billingStatus === "partially_collected") return "partial";
  if (billingStatus === "invoiced") return "pending";
  return null;
}

function deriveWorkflowStatusFromPosts(
  posts: AssignmentPostOperationalRow[],
  billingStatus: AssignmentDeliverableBillingStatus
): string {
  if (posts.length === 0) {
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
    if (posts.some((p) => p.workflow_status === status)) return status;
  }
  return posts[0]?.workflow_status ?? "draft";
}

function deriveDeliverableLockState(
  row: {
    locked_at: string | null;
    live_date: string | null;
    billing_status: AssignmentDeliverableBillingStatus;
    invoice_line_item_id: string | null;
  },
  billingContext?: AssignmentHierarchyBillingContext
) {
  const lockedAt = row.locked_at;
  const liveDate = row.live_date;
  const commercialLocked = isDeliverableCommercialLocked({
    locked_at: lockedAt,
    billing_status: row.billing_status,
    invoice_line_item_id: row.invoice_line_item_id,
    regeneration_status: billingContext?.regeneration_status,
  });
  return {
    commercialLocked,
    liveAdDateLocked: isLiveAdDateLocked(liveDate, lockedAt),
    lockedAt,
  };
}

function buildVirtualPosts(input: {
  deliverableId: string;
  quantity: number;
  platform: string;
  deliverableType: string;
  unitRevenue: number;
  unitCost: number;
  revenueVatPercent: number;
  revenueVatPerPost: number;
  costVatPerPost: number;
  liveDate: string | null;
  notes: string | null;
  billingStatus: AssignmentDeliverableBillingStatus;
  collectionStatus: DeliverableCollectionStatus;
  invoiceId: string | null;
  invoiceDocumentNumber: string | null;
  payoutStatus: AssignmentDeliverableHierarchyRow["payout_status"];
  isLocked: boolean;
}): AssignmentPostOperationalRow[] {
  const qty = Math.max(1, input.quantity);
  return Array.from({ length: qty }, (_, index) => ({
    id: `virtual-${input.deliverableId}-${index + 1}`,
    assignment_deliverable_id: input.deliverableId,
    sequence_number: index + 1,
    label: formatDeliverableHierarchyLabel({
      platform: input.platform,
      deliverable_type: input.deliverableType,
      sequence: index + 1,
    }),
    platform: input.platform,
    deliverable_type: input.deliverableType,
    deliverable_type_label: deliverableTypeLabel(input.deliverableType),
    live_date: input.liveDate,
    workflow_status: "draft",
    notes: input.notes,
    revenue_per_post: input.unitRevenue,
    cost_per_post: input.unitCost,
    revenue_vat_percent: input.revenueVatPercent,
    revenue_vat_amount: input.revenueVatPerPost,
    cost_vat_amount: input.costVatPerPost,
    billing_status: input.billingStatus,
    collection_status: input.collectionStatus,
    invoice_id: input.invoiceId,
    invoice_document_number: input.invoiceDocumentNumber,
    payout_status: input.payoutStatus,
    is_locked: input.isLocked,
  }));
}

export async function getCampaignAssignmentHierarchy(
  campaignId: string,
  workspaceSeed?: Awaited<ReturnType<typeof getCampaignWorkspace>> | null
): Promise<AssignmentHierarchy> {
  try {
    return await loadCampaignAssignmentHierarchy(campaignId, workspaceSeed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load assignment hierarchy.";
    console.error("[assignment-hierarchy] load failed", { campaignId, message });
    return {
      groups: [],
      currency_code: DEFAULT_PLATFORM_CURRENCY,
      load_error: message,
      skipped_line_ids: [],
      sanitize_warnings: [],
    };
  }
}

async function loadCampaignAssignmentHierarchy(
  campaignId: string,
  workspaceSeed?: Awaited<ReturnType<typeof getCampaignWorkspace>> | null
): Promise<AssignmentHierarchy> {
  const workspace = workspaceSeed ?? (await getCampaignWorkspace(campaignId));
  if (!workspace) {
    return { groups: [], currency_code: DEFAULT_PLATFORM_CURRENCY };
  }
  const { supabase } = await requireRequestUser();

  const lineIds = workspace.lines.map((l) => l.id);
  if (lineIds.length === 0) {
    return { groups: [], currency_code: workspace.currency_code };
  }

  const pendingInvoice = (workspace.invoices ?? []).find(
    (invoice) => invoice.regeneration_status === "pending_regeneration"
  );
  const billingContext: AssignmentHierarchyBillingContext | undefined = pendingInvoice
    ? {
        pending_regeneration_invoice_id: pendingInvoice.id,
        regeneration_status: pendingInvoice.regeneration_status ?? "pending_regeneration",
        invoice_status: pendingInvoice.status,
      }
    : undefined;

  const { data: deliverableRows, includesVatExempt, error: deliverableQueryError } =
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

  if (deliverableQueryError) {
    console.warn("[assignment-hierarchy] assignment_deliverables query failed", {
      campaignId,
      message: deliverableQueryError,
    });
  }

  const deliverableIds = (deliverableRows ?? []).map((d) => d.id);

  const schedulesResult = await queryPostSchedulesForLines(supabase, lineIds);

  const invoiceItemsResult =
    deliverableIds.length > 0
      ? await supabase
          .from("invoice_line_items")
          .select("assignment_deliverable_id, invoice_id")
          .in("assignment_deliverable_id", deliverableIds)
      : { data: [], error: null };

  if (invoiceItemsResult.error) {
    console.warn("[assignment-hierarchy] invoice_line_items query failed", {
      message: invoiceItemsResult.error.message,
    });
  }

  const loadWarnings = [
    deliverableQueryError,
    schedulesResult.error,
    invoiceItemsResult.error?.message,
  ].filter(Boolean) as string[];

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

  type ScheduleRow = {
    id: string;
    assignment_deliverable_id: string;
    sequence_number: number;
    live_date: string | null;
    status: string;
    notes: string | null;
    metadata?: Record<string, unknown>;
    revenue_before_vat?: number;
    cost_before_vat?: number;
    revenue_vat_percent?: number;
    revenue_vat_amount?: number;
    cost_vat_amount?: number;
    billing_status?: string;
  };

  const postsByDeliverable = new Map<string, AssignmentPostOperationalRow[]>();
  for (const row of (schedulesResult.data ?? []) as ScheduleRow[]) {
    const list = postsByDeliverable.get(row.assignment_deliverable_id) ?? [];
    const meta = (row.metadata ?? {}) as { platform?: string; deliverable_type?: string };
    list.push({
      id: row.id,
      assignment_deliverable_id: row.assignment_deliverable_id,
      sequence_number: row.sequence_number,
      label: `#${row.sequence_number}`,
      platform: meta.platform ?? "instagram",
      deliverable_type: meta.deliverable_type ?? "other",
      deliverable_type_label: deliverableTypeLabel(meta.deliverable_type ?? "other"),
      live_date: row.live_date,
      workflow_status: row.status ?? "draft",
      notes: row.notes,
      revenue_per_post: Number(
        row.revenue_before_vat ??
          (row as { billable_amount?: number | null }).billable_amount ??
          0
      ),
      cost_per_post: Number(row.cost_before_vat ?? 0),
      revenue_vat_percent: Number(row.revenue_vat_percent ?? 0),
      revenue_vat_amount: Number(row.revenue_vat_amount ?? 0),
      cost_vat_amount: Number(row.cost_vat_amount ?? 0),
      billing_status: (row.billing_status ?? "draft") as AssignmentDeliverableBillingStatus,
      collection_status: deriveCollectionStatus(
        (row.billing_status ?? "draft") as AssignmentDeliverableBillingStatus
      ),
      invoice_id: null,
      invoice_document_number: null,
      payout_status: null,
      is_locked: false,
      metadata: row.metadata ?? undefined,
    });
    postsByDeliverable.set(row.assignment_deliverable_id, list);
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
    let posts = postsByDeliverable.get(row.id) ?? [];
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
    const unitRevenue = Number(row.revenue_before_vat) / qty;
    const unitCost = Number(row.unit_cost ?? 0);
    const vatPerPost = Number(row.revenue_vat_amount ?? 0) / qty;
    const costVatPerPost = Number(row.cost_vat_amount ?? 0) / qty;

    const lockState = deriveDeliverableLockState(
      {
        locked_at: row.locked_at,
        live_date: row.live_date,
        billing_status: billingStatus,
        invoice_line_item_id: row.invoice_line_item_id,
      },
      billingContext
    );

    if (posts.length === 0) {
      posts = buildVirtualPosts({
        deliverableId: row.id,
        quantity: qty,
        platform: row.platform,
        deliverableType: row.deliverable_type,
        unitRevenue,
        unitCost,
        revenueVatPercent: Number(row.revenue_vat_percent ?? 0),
        revenueVatPerPost: vatPerPost,
        costVatPerPost: costVatPerPost,
        liveDate: row.live_date,
        notes: row.notes ?? null,
        billingStatus,
        collectionStatus: deriveCollectionStatus(billingStatus),
        invoiceId: invoiceLink?.invoice_id ?? null,
        invoiceDocumentNumber: invoiceLink?.document_number ?? null,
        payoutStatus: line?.vendor_payment_status ?? null,
        isLocked: lockState.commercialLocked,
      });
    } else {
      posts = posts.map((post) => {
        const scheduleRow = (schedulesResult.data ?? []).find(
          (s) => s.id === post.id
        ) as ScheduleRow | undefined;
        const meta = (scheduleRow?.metadata ?? {}) as {
          platform?: string;
          deliverable_type?: string;
        };
        const platform = meta.platform ?? row.platform;
        const deliverableType = meta.deliverable_type ?? row.deliverable_type;
        return {
          ...post,
          platform,
          deliverable_type: deliverableType,
          deliverable_type_label: deliverableTypeLabel(deliverableType),
          label: formatDeliverableHierarchyLabel({
            platform,
            deliverable_type: deliverableType,
            sequence: post.sequence_number,
          }),
          invoice_id: invoiceLink?.invoice_id ?? null,
          invoice_document_number: invoiceLink?.document_number ?? null,
          payout_status: line?.vendor_payment_status ?? null,
          is_locked: lockState.commercialLocked,
        };
      });
    }

    const resolvedLiveDate = row.live_date ?? posts[0]?.live_date ?? null;

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
      unit_revenue: unitRevenue,
      live_date: resolvedLiveDate,
      notes: row.notes ?? null,
      revenue_before_vat: Number(row.revenue_before_vat),
      usage_rights_amount: Number(
        (row as { usage_rights_amount?: number }).usage_rights_amount ?? 0
      ),
      usage_rights_cost: Number(
        (row as { usage_rights_cost?: number }).usage_rights_cost ?? 0
      ),
      agency_fee_percent: Number(
        (row as { agency_fee_percent?: number }).agency_fee_percent ?? 0
      ),
      agency_fee_amount: Number(
        (row as { agency_fee_amount?: number }).agency_fee_amount ?? 0
      ),
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
      workflow_status: deriveWorkflowStatusFromPosts(posts, billingStatus),
      posts,
      remaining_amount: Number(row.remaining_amount),
      invoiced_amount: Number(row.invoiced_amount),
      invoice_eligible:
        line != null &&
        lineAllowsDeliverableInvoice(line) &&
        isDeliverableInvoiceEligible(
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
          line.billing_status ?? "draft"
        ),
      is_synthetic: false,
      is_locked: lockState.commercialLocked,
      locked_at: lockState.lockedAt,
      live_ad_date_locked: lockState.liveAdDateLocked,
    };

    const list = deliverablesByLine.get(row.campaign_line_id) ?? [];
    list.push(mapped);
    deliverablesByLine.set(row.campaign_line_id, list);
  }

  const groups: AssignmentHierarchyGroup[] = [];

  for (const line of workspace.lines) {
    const lineId = line.id;
    try {
      const rawDeliverables = deliverablesByLine.get(lineId) ?? [];
      const deliverables = alignPackageLineCommercialToDeliverables(rawDeliverables, line);
      const rollups = buildAssignmentHierarchyRollups(deliverables, line);
      groups.push({ line, deliverables, rollups });
    } catch (error) {
      console.error("[assignment-hierarchy] group mapping failed — skipping row", {
        campaignId,
        lineId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  const result = sanitizeAssignmentHierarchy(
    {
      groups,
      currency_code: workspace.currency_code,
      billing_context: billingContext,
      load_error: loadWarnings.length > 0 ? loadWarnings.join(" · ") : null,
    },
    { campaignId }
  );

  logAssignmentsStage("hierarchy built", {
    campaignId,
    groupCount: result.groups.length,
    skipped: result.skipped_line_ids?.length ?? 0,
    sanitizeWarnings: result.sanitize_warnings?.length ?? 0,
  });

  logRevisionHierarchyKeys(result, { campaignId });

  return result;
}
