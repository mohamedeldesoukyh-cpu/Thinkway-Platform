import type {
  AssignmentDeliverableBillingStatus,
  CampaignLineBillingStatus,
} from "@/features/billing/types";

export type OperationalBillingRowKind = "assignment" | "deliverable_group" | "post";

export type OperationalBillingRow = {
  id: string;
  kind: OperationalBillingRowKind;
  campaign_header_id: string;
  campaign_line_id: string;
  assignment_deliverable_id: string | null;
  parent_id: string | null;
  label: string;
  document_number: string | null;
  influencer_name: string | null;
  platform: string | null;
  deliverable_type: string | null;
  billable_amount: number;
  invoiced_amount: number;
  collected_amount: number;
  remaining_amount: number;
  billing_status: string;
  line_billing_status: CampaignLineBillingStatus;
  invoice_id: string | null;
  invoice_document_number: string | null;
  invoice_line_item_id: string | null;
  locked_at: string | null;
  is_locked: boolean;
  is_invoice_eligible: boolean;
  is_achieved: boolean;
  is_legacy_synthetic: boolean;
  revenue_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  /** Assignment-level VAT fallback (line / package). */
  line_revenue_vat_percent?: number;
  line_revenue_vat_exempt?: boolean;
  operational_status?: string | null;
  vendor_io_id?: string | null;
  vendor_io_document_number?: string | null;
  children: OperationalBillingRow[];
};

export type CampaignFinancialRollup = {
  campaign_header_id: string;
  total_campaign_amount: number;
  achieved_revenue: number;
  already_invoiced: number;
  remaining_to_invoice: number;
  unachieved_revenue: number;
  operational_row_count: number;
  achieved_row_count: number;
  invoiced_row_count: number;
};

const ACHIEVED_LINE_STATUSES = new Set<CampaignLineBillingStatus>([
  "approved",
  "moved_to_billing",
  "partially_invoiced",
  "invoiced",
  "partially_paid",
  "paid",
  "closed",
]);

const ACHIEVED_DELIVERABLE_STATUSES = new Set<string>([
  "ready_to_invoice",
  "partially_invoiced",
  "invoiced",
  "partially_collected",
  "collected",
]);

export function isOperationalRowAchieved(
  row: Pick<OperationalBillingRow, "kind" | "billing_status" | "line_billing_status" | "is_achieved">
): boolean {
  if (row.is_achieved) return true;
  if (row.kind === "assignment") {
    return ACHIEVED_LINE_STATUSES.has(row.line_billing_status);
  }
  if (ACHIEVED_DELIVERABLE_STATUSES.has(row.billing_status)) return true;
  if (["disputed", "cancelled"].includes(row.billing_status)) return false;
  // Deliverable/post rows inherit achievement once parent assignment is billing-ready.
  if (
    ["moved_to_billing", "partially_invoiced", "invoiced", "partially_paid", "paid", "closed"].includes(
      row.line_billing_status
    )
  ) {
    return true;
  }
  if (row.line_billing_status === "approved" && row.billing_status === "ready_to_invoice") {
    return true;
  }
  return false;
}

export function isOperationalRowInvoiceEligible(
  row: Pick<
    OperationalBillingRow,
    | "kind"
    | "is_locked"
    | "remaining_amount"
    | "billing_status"
    | "line_billing_status"
    | "is_invoice_eligible"
    | "operational_status"
    | "vendor_io_id"
  >
): boolean {
  if (row.is_locked || row.remaining_amount <= 0) return false;
  if (row.billing_status === "disputed" || row.billing_status === "cancelled") return false;
  if (["invoiced", "collected"].includes(row.billing_status)) return false;

  const operational = (row.operational_status ?? "draft") as
    import("@/features/campaigns/types/operational").CampaignLineOperationalStatus;

  if (operational === "draft" || operational === "invoiced" || operational === "closed") {
    return false;
  }
  if (!row.vendor_io_id) return false;

  return row.is_invoice_eligible !== false;
}

const UI_SELECTABLE_OPERATIONAL = new Set<
  import("@/features/campaigns/types/operational").CampaignLineOperationalStatus
>(["io_generated", "partially_invoiced", "reopened"]);

const UI_BLOCKED_LINE_BILLING = new Set<CampaignLineBillingStatus>([
  "invoiced",
  "paid",
  "closed",
  "partially_paid",
]);

/** UI checkbox eligibility (excludes invoiced / locked / paid lines from Select all). */
export function isOperationalRowUiSelectable(
  row: Pick<
    OperationalBillingRow,
    | "kind"
    | "is_locked"
    | "remaining_amount"
    | "billing_status"
    | "line_billing_status"
    | "operational_status"
    | "vendor_io_id"
  >
): boolean {
  if (row.is_locked) return false;
  if (row.remaining_amount <= 0) return false;
  if (row.billing_status === "disputed" || row.billing_status === "cancelled") return false;
  if (["invoiced", "collected"].includes(row.billing_status)) return false;
  if (UI_BLOCKED_LINE_BILLING.has(row.line_billing_status)) return false;

  const operational = (row.operational_status ?? "draft") as
    import("@/features/campaigns/types/operational").CampaignLineOperationalStatus;

  if (operational === "invoiced" || operational === "draft") return false;

  const operationalOk = UI_SELECTABLE_OPERATIONAL.has(operational);
  const movedToBilling = row.line_billing_status === "moved_to_billing";

  if (!operationalOk && !movedToBilling) return false;
  if (row.kind === "assignment" && !row.vendor_io_id) return false;

  return true;
}

export function isOperationalRowActionEligible(
  row: Pick<
    OperationalBillingRow,
    "kind" | "is_locked" | "billing_status" | "line_billing_status"
  >
): boolean {
  if (row.is_locked) return false;
  if (row.billing_status === "disputed" || row.billing_status === "cancelled") return false;
  if (row.kind === "assignment") {
    return ["draft", "approved"].includes(row.line_billing_status);
  }
  return !["invoiced", "collected"].includes(row.billing_status);
}

export function rollupOperationalRows(rows: OperationalBillingRow[]): CampaignFinancialRollup | null {
  if (rows.length === 0) return null;

  const campaignId = rows[0]?.campaign_header_id;
  const leafRows = flattenOperationalLeaves(rows);

  let total_campaign_amount = 0;
  let achieved_revenue = 0;
  let already_invoiced = 0;
  let achieved_row_count = 0;
  let invoiced_row_count = 0;

  for (const row of leafRows) {
    total_campaign_amount += row.billable_amount;
    if (isOperationalRowAchieved(row)) {
      achieved_revenue += row.billable_amount;
      achieved_row_count += 1;
    }
    already_invoiced += row.invoiced_amount;
    if (row.invoiced_amount > 0 || row.is_locked) {
      invoiced_row_count += 1;
    }
  }

  const remaining_to_invoice = Math.max(0, achieved_revenue - already_invoiced);
  const unachieved_revenue = Math.max(0, total_campaign_amount - achieved_revenue);

  const rollup: CampaignFinancialRollup = {
    campaign_header_id: campaignId,
    total_campaign_amount,
    achieved_revenue,
    already_invoiced,
    remaining_to_invoice,
    unachieved_revenue,
    operational_row_count: leafRows.length,
    achieved_row_count,
    invoiced_row_count,
  };

  if (process.env.NODE_ENV === "development") {
    console.debug("[operational-billing] campaign rollup", {
      campaignId,
      ...rollup,
      leafCount: leafRows.length,
    });
  }

  return rollup;
}

/** Prefer post leaves, then deliverable leaves, then assignment roots. */
export function flattenOperationalLeaves(rows: OperationalBillingRow[]): OperationalBillingRow[] {
  const leaves: OperationalBillingRow[] = [];

  function walk(node: OperationalBillingRow) {
    if (node.children.length > 0) {
      for (const child of node.children) walk(child);
      return;
    }
    leaves.push(node);
  }

  for (const row of rows) walk(row);
  return leaves;
}

export function collectOperationalRowIds(rows: OperationalBillingRow[]): {
  line_ids: string[];
  deliverable_ids: string[];
  post_ids: string[];
} {
  const line_ids = new Set<string>();
  const deliverable_ids = new Set<string>();
  const post_ids = new Set<string>();

  function walk(node: OperationalBillingRow) {
    if (node.kind === "assignment") line_ids.add(node.id);
    if (node.kind === "deliverable_group") deliverable_ids.add(node.id);
    if (node.kind === "post") post_ids.add(node.id);
    for (const child of node.children) walk(child);
  }

  for (const row of rows) walk(row);

  return {
    line_ids: [...line_ids],
    deliverable_ids: [...deliverable_ids],
    post_ids: [...post_ids],
  };
}

export function deriveCampaignBillingStatus(
  rows: OperationalBillingRow[]
): CampaignLineBillingStatus {
  const leaves = flattenOperationalLeaves(rows);
  if (leaves.length === 0) return "draft";

  const statuses = new Set(leaves.map((r) => r.billing_status));
  const lineStatuses = new Set(rows.filter((r) => r.kind === "assignment").map((r) => r.line_billing_status));

  if (statuses.has("disputed")) return "partially_invoiced";
  if (leaves.every((r) => r.invoiced_amount >= r.billable_amount && r.billable_amount > 0)) {
    return "invoiced";
  }
  if (leaves.some((r) => r.invoiced_amount > 0)) return "partially_invoiced";
  if (lineStatuses.has("moved_to_billing")) return "moved_to_billing";
  if (lineStatuses.has("approved")) return "approved";
  return "draft";
}

export type PostBillingSource = {
  id: string;
  assignment_deliverable_id: string;
  campaign_line_id: string;
  sequence_number: number;
  live_date: string | null;
  billing_status: string;
  revenue_before_vat: number;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
  collected_amount?: number | null;
  remaining_amount?: number | null;
  invoice_line_item_id?: string | null;
  locked_at?: string | null;
  platform?: string | null;
  deliverable_type?: string | null;
};

export function buildPostOperationalRow(
  post: PostBillingSource,
  deliverable: {
    platform: string;
    deliverable_type: string;
    billing_status: AssignmentDeliverableBillingStatus;
    revenue_vat_percent?: number;
    revenue_vat_exempt?: boolean;
  },
  line: {
    campaign_header_id: string;
    billing_status: CampaignLineBillingStatus;
    invoice_id: string | null;
    invoice_document_number: string | null;
    revenue_vat_percent?: number;
    revenue_vat_exempt?: boolean;
    operational_status?: string | null;
    vendor_io_id?: string | null;
    vendor_io_document_number?: string | null;
  },
  label: string
): OperationalBillingRow {
  const billable = Number(post.billable_amount ?? post.revenue_before_vat ?? 0);
  const invoiced = Number(post.invoiced_amount ?? 0);
  const collected = Number(post.collected_amount ?? 0);
  const remaining = Number(
    post.remaining_amount ?? Math.max(0, billable - invoiced)
  );
  const locked = Boolean(post.locked_at || post.invoice_line_item_id);

  return {
    id: post.id,
    kind: "post",
    campaign_header_id: line.campaign_header_id,
    campaign_line_id: post.campaign_line_id,
    assignment_deliverable_id: post.assignment_deliverable_id,
    parent_id: post.assignment_deliverable_id,
    label,
    document_number: null,
    influencer_name: null,
    platform: deliverable.platform,
    deliverable_type: deliverable.deliverable_type,
    billable_amount: billable,
    invoiced_amount: invoiced,
    collected_amount: collected,
    remaining_amount: remaining,
    billing_status: post.billing_status || deliverable.billing_status,
    line_billing_status: line.billing_status,
    invoice_id: line.invoice_id,
    invoice_document_number: line.invoice_document_number,
    invoice_line_item_id: post.invoice_line_item_id ?? null,
    locked_at: post.locked_at ?? null,
    is_locked: locked,
    is_invoice_eligible:
      line.operational_status === "io_generated" &&
      Boolean(line.vendor_io_id) &&
      !locked &&
      remaining > 0,
    operational_status: line.operational_status ?? "draft",
    vendor_io_id: line.vendor_io_id ?? null,
    vendor_io_document_number: line.vendor_io_document_number ?? null,
    is_achieved: ACHIEVED_DELIVERABLE_STATUSES.has(post.billing_status || deliverable.billing_status),
    is_legacy_synthetic: false,
    revenue_before_vat: Number(post.revenue_before_vat ?? 0),
    revenue_vat_percent: Number(deliverable.revenue_vat_percent ?? 0),
    revenue_vat_exempt: Boolean(deliverable.revenue_vat_exempt),
    line_revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
    line_revenue_vat_exempt: Boolean(line.revenue_vat_exempt),
    children: [],
  };
}

export function aggregateRollupFromLeaves(
  leaves: OperationalBillingRow[]
): Pick<
  CampaignFinancialRollup,
  | "total_campaign_amount"
  | "achieved_revenue"
  | "already_invoiced"
  | "remaining_to_invoice"
  | "unachieved_revenue"
> {
  let total_campaign_amount = 0;
  let achieved_revenue = 0;
  let already_invoiced = 0;

  for (const row of leaves) {
    total_campaign_amount += row.billable_amount;
    if (isOperationalRowAchieved(row)) achieved_revenue += row.billable_amount;
    already_invoiced += row.invoiced_amount;
  }

  const rollup = {
    total_campaign_amount,
    achieved_revenue,
    already_invoiced,
    remaining_to_invoice: Math.max(0, achieved_revenue - already_invoiced),
    unachieved_revenue: Math.max(0, total_campaign_amount - achieved_revenue),
  };

  if (process.env.NODE_ENV === "development") {
    console.debug("[operational-billing] rollup from leaves", {
      leafCount: leaves.length,
      ...rollup,
    });
    console.debug("[billing-rollup] leaf aggregation", {
      leafCount: leaves.length,
      ...rollup,
    });
  }

  return rollup;
}
