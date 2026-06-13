import type { AgencyOrDirect, CampaignStatus } from "@/types/database";
import type { PoHealth } from "@/lib/finance/po/calculations";
import type { PoStatus } from "@/lib/finance/po/status";

import type { LineInfluencerAssignment } from "./line-assignment";
import type {
  ClientIoRow,
  ClientIoSendHistoryEntry,
  VendorIoRow,
  ClientIoSendRecipient,
} from "@/features/io/types";

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

export type CampaignPoSummary = {
  po_number: string | null;
  po_currency: string | null;
  po_exchange_rate: number | null;
  po_amount_original: number;
  po_amount_campaign_currency: number;
  po_consumed_amount: number;
  po_remaining_amount: number;
  po_remaining_percent: number | null;
  po_status: PoStatus;
  po_expiry_date: string | null;
  po_override_approved: boolean;
  po_override_reason: string | null;
  fx_snapshot_at: string | null;
  health: PoHealth;
};

export type CampaignFinancialSummary = {
  /** Operational PO budget (po_amount_campaign_currency or legacy fallback). */
  budget: number;
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  /** Same as budget — operational PO total in campaign currency. */
  po_total: number;
  /** Operational PO remaining (po_remaining_amount or computed). */
  remaining_po: number;
  po_consumed: number;
  po_remaining_percent: number | null;
  po_status: PoStatus;
  po_health: PoHealth;
  po_exceeded: boolean;
  billing_outstanding: number;
  collected: number;
};

export type CreatorPlatformAccountSummary = {
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
};

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
  revenue_before_vat: number;
  usage_rights_amount: number;
  usage_rights_cost: number;
  agency_fee_percent: number;
  agency_fee_amount: number;
  revenue_vat_percent: number;
  revenue_vat_amount: number;
  revenue_after_vat: number;
  revenue_vat_exempt: boolean;
  cost_received: number;
  cost_received_currency: string;
  cost_before_vat: number;
  cost_vat_percent: number;
  cost_vat_amount: number;
  cost_after_vat: number;
  cost_vat_exempt: boolean;
  vat_locked: boolean;
  gp: number;
  margin_percent: number;
  po_amount: number;
  remaining_po: number;
  billing_status: import("@/features/billing/types").CampaignLineBillingStatus;
  operational_status: import("@/features/campaigns/types/operational").CampaignLineOperationalStatus;
  vendor_io_id: string | null;
  /** Active (non-superseded) Vendor IO — null when pointer is orphan or superseded-only. */
  active_vendor_io_id?: string | null;
  vendor_io_document_number: string | null;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  /** Active after invoice ungenerate — allows commercial edits before regeneration. */
  finance_override_until: string | null;
  invoice_id: string | null;
  po_consumed: number;
  po_over_consumed: boolean;
  payment_status: LinePaymentStatus;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  assignment: LineInfluencerAssignment | null;
  /** All platforms linked on the creator profile (influencer_platform_accounts). */
  creator_platform_accounts: CreatorPlatformAccountSummary[];
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
    follower_count: number | null;
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
  regeneration_status?: string | null;
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
  po: CampaignPoSummary;
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
  client_io: ClientIoRow | null;
  client_io_send_recipients: ClientIoSendRecipient[];
  client_io_send_history: ClientIoSendHistoryEntry[];
  client_io_sender_name: string | null;
  vendor_ios: VendorIoRow[];
  vat_context: {
    client_country_code: string | null;
    default_revenue_vat_percent: number;
  };
};

export type InfluencerSearchResult = {
  id: string;
  document_number: string;
  display_name: string;
  status: string;
  country_code: string | null;
  suggested_currency: string;
  categories?: string[];
  notes?: string | null;
  platforms: {
    id: string;
    platform: string;
    handle: string;
    profile_url: string | null;
    follower_count: number | null;
    engagement_rate: number | null;
    audience_country: string | null;
    is_verified?: boolean;
  }[];
};

export type CreatorBrowseFilters = {
  search?: string;
  platform?: string;
  country?: string;
  category?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  page?: number;
  pageSize?: number;
};

export type CreatorBrowseResult = {
  creators: InfluencerSearchResult[];
  unified_creators?: import("@/lib/creators/types").UnifiedCreatorResult[];
  total: number;
  page: number;
  pageSize: number;
  internal_count?: number;
  discovery_count?: number;
};

export type InfluencerAssignmentProfile = InfluencerSearchResult & {
  rate_card: Record<string, unknown>;
  payment_details: Record<string, unknown>;
  suggested_cost: number;
  vat_registered: boolean;
  default_vat_percent: number;
  tax_registration_number: string | null;
  suggested_cost_vat_percent: number;
  notes?: string | null;
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
