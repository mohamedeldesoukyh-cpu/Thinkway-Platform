import type { AgencyOrDirect, CampaignStatus } from "@/types/database";

export type BrandFormOption = {
  id: string;
  name: string;
  client_id: string;
  group_id: string;
  currency_code: string;
  group: { id: string; name: string } | null;
  client: {
    id: string;
    name: string;
    legal_name: string | null;
    agency_or_direct: AgencyOrDirect | null;
  } | null;
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string } | null;
  vr_rate: { id: string; name: string; rate_percent: number } | null;
};

export type WorkflowStage =
  | "planning"
  | "negotiation"
  | "live"
  | "completed"
  | "invoicing"
  | "closed";

export type { CampaignLineBillingStatus as LineBillingStatus } from "@/features/billing/types";

export type LinePaymentStatus =
  | "pending"
  | "partial"
  | "paid";

export type CampaignLineAssignmentStatus =
  | "draft"
  | "assigned"
  | "awaiting_content"
  | "submitted"
  | "approved"
  | "scheduled"
  | "posted"
  | "verified"
  | "invoiced"
  | "paid"
  | "closed";

export type VendorPaymentStatus = "unpaid" | "pending" | "paid" | "cancelled";

export type CampaignFinancialSummary = {
  budget: number;
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  po_total: number;
  remaining_po: number;
  billing_outstanding: number;
  collected: number;
};

import type { LineInfluencerAssignment } from "./line-assignment";

export type CampaignLineWorkspace = {
  id: string;
  document_number: string;
  name: string;
  status: CampaignStatus;
  assignment_status: CampaignLineAssignmentStatus;
  platform: string | null;
  influencer_id: string | null;
  influencer_name: string | null;
  platform_summary: string | null;
  deliverable_count: number;
  influencer_count: number;
  campaign_influencer_id: string | null;
  vendor_payment_status: VendorPaymentStatus | null;
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  po_amount: number;
  remaining_po: number;
  billing_status: import("@/features/billing/types").CampaignLineBillingStatus;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  invoice_id: string | null;
  po_consumed: number;
  po_over_consumed: boolean;
  payment_status: LinePaymentStatus;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  assignment: LineInfluencerAssignment | null;
};

/** @deprecated Historical vendor rows — assignments are managed via campaign lines. */
export type CampaignVendorAssignment = {
  id: string;
  campaign_line_id: string | null;
  line_document_number: string | null;
  influencer_id: string;
  influencer_name: string;
  influencer_document_number: string;
  status: string;
  agreed_fee: number;
  currency: string;
  deliverable_count: number;
  vendor_payment_status: string | null;
  platforms: {
    platform: string;
    handle: string;
    profile_url: string | null;
    follower_count: number;
    engagement_rate: number | null;
  }[];
  invited_at: string | null;
  confirmed_at: string | null;
};

export type CampaignDeliverableRow = {
  id: string;
  document_number: string;
  deliverable_type: string;
  title: string;
  status: string;
  display_status: "pending" | "submitted" | "approved" | "rejected" | "posted";
  influencer_name: string;
  platform: string | null;
  due_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  content_url: string | null;
  metrics: Record<string, unknown>;
};

export type CampaignInvoiceRow = {
  id: string;
  document_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  outstanding: number;
  currency: string;
};

export type CampaignPaymentRow = {
  id: string;
  document_number: string;
  invoice_document_number: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
};

export type CampaignApprovalRow = {
  id: string;
  document_number: string;
  entity_type: string;
  title: string;
  status: string;
  assigned_to_name: string | null;
  due_at: string | null;
  decided_at: string | null;
};

export type CampaignActivityItem = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  actor: { id: string; full_name: string | null; email: string } | null;
  summary: string;
};

export type CampaignWorkspace = {
  id: string;
  document_number: string;
  name: string;
  description: string | null;
  brief: string | null;
  status: CampaignStatus;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  platform: string | null;
  group: { id: string; name: string; document_number: string } | null;
  client: {
    id: string;
    name: string;
    document_number: string;
    legal_name: string | null;
  } | null;
  brand: { id: string; name: string; document_number: string } | null;
  team: { id: string; name: string } | null;
  account_manager: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  financials: CampaignFinancialSummary;
  workflow_stage: WorkflowStage;
  lines: CampaignLineWorkspace[];
  /** @deprecated Derived from line-linked campaign_influencers for historical records only. */
  vendors: CampaignVendorAssignment[];
  deliverables: CampaignDeliverableRow[];
  invoices: CampaignInvoiceRow[];
  payments: CampaignPaymentRow[];
  approvals: CampaignApprovalRow[];
  activity: CampaignActivityItem[];
  blockers: string[];
};

export type InfluencerSearchResult = {
  id: string;
  document_number: string;
  display_name: string;
  status: string;
  country_code: string | null;
  suggested_currency: string;
  platforms: {
    id: string;
    platform: string;
    handle: string;
    profile_url: string | null;
    follower_count: number;
    engagement_rate: number | null;
    audience_country: string | null;
  }[];
};

export type InfluencerAssignmentProfile = InfluencerSearchResult & {
  rate_card: Record<string, unknown>;
  payment_details: Record<string, unknown>;
  suggested_cost: number;
};

export function formatMarginPercent(revenue: number, gp: number): number {
  if (revenue <= 0) {
    return 0;
  }
  return Math.round((gp / revenue) * 10000) / 100;
}

export function mapDeliverableDisplayStatus(
  status: string
): CampaignDeliverableRow["display_status"] {
  switch (status) {
    case "submitted":
    case "revision_requested":
      return "submitted";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "published":
      return "posted";
    default:
      return "pending";
  }
}

export function deriveWorkflowStage(input: {
  status: CampaignStatus;
  lines: Pick<CampaignLineWorkspace, "assignment_status">[];
  invoices: CampaignInvoiceRow[];
}): WorkflowStage {
  const { status, lines, invoices } = input;
  const inExecution = lines.some((l) =>
    [
      "assigned",
      "awaiting_content",
      "submitted",
      "approved",
      "scheduled",
      "posted",
      "verified",
    ].includes(l.assignment_status)
  );
  const openInvoices = invoices.filter(
    (i) =>
      !["paid", "void", "draft"].includes(i.status) && i.outstanding > 0
  );
  const allInvoicesPaid =
    invoices.length > 0 &&
    invoices.every(
      (i) => i.status === "paid" || i.outstanding <= 0
    );

  if (status === "completed" && allInvoicesPaid && invoices.length > 0) {
    return "closed";
  }
  if (openInvoices.length > 0 && ["completed", "active"].includes(status)) {
    return "invoicing";
  }
  if (status === "completed") {
    return "completed";
  }
  if (status === "active" || inExecution) {
    return "live";
  }
  if (lines.some((l) => l.assignment_status === "draft")) {
    return "planning";
  }
  return "planning";
}

export function deriveLinePaymentStatus(
  cost: number,
  vendorFeesOnLine: number
): LinePaymentStatus {
  if (vendorFeesOnLine <= 0) {
    return "pending";
  }
  if (cost >= vendorFeesOnLine) {
    return "paid";
  }
  if (cost > 0) {
    return "partial";
  }
  return "pending";
}
