import type {
  InfluencerDocumentRow,
  InfluencerPlatformAccountRow,
  InfluencerRow,
  InfluencerStatus,
  VendorCampaignAssignment,
} from "@/types/database";

export type VendorFinancialSummary = {
  total_revenue: number;
  total_cost: number;
  total_gp: number;
  margin_percent: number;
  invoiced_amount: number;
  paid_out: number;
  pending_payout: number;
};

export type VendorCounts = {
  assignments: number;
  campaigns: number;
  deliverables: number;
  platforms: number;
};

export type VendorAssignmentRow = {
  id: string;
  campaign_line_id: string | null;
  line_document_number: string | null;
  line_name: string | null;
  assignment_status: string | null;
  billing_status: string | null;
  campaign_id: string | null;
  campaign_document_number: string | null;
  campaign_name: string | null;
  campaign_status: string | null;
  status: string;
  agreed_fee: number;
  currency: string;
  deliverable_count: number;
  vendor_payment_status: string | null;
  revenue: number;
  cost: number;
  gp: number;
  invited_at: string | null;
  confirmed_at: string | null;
};

export type VendorDeliverableRow = {
  id: string;
  document_number: string;
  title: string;
  deliverable_type: string;
  status: string;
  platform: string | null;
  due_date: string | null;
  campaign_name: string | null;
};

export type VendorPayoutRow = {
  id: string;
  assignment_id: string;
  campaign_name: string | null;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
};

export type VendorActivityItem = {
  id: string;
  action: string;
  entity_type: string;
  summary: string;
  created_at: string;
  actor: { id: string; full_name: string | null; email: string } | null;
};

export type VendorListRow = InfluencerRow & {
  platform_accounts: Pick<
    InfluencerPlatformAccountRow,
    "id" | "platform" | "handle" | "follower_count" | "is_primary"
  >[];
  assignment_count: number;
  active_campaign_count: number;
};

export type VendorWorkspace = InfluencerRow & {
  platform_accounts: InfluencerPlatformAccountRow[];
  documents: InfluencerDocumentRow[];
  campaign_assignments: VendorCampaignAssignment[];
  financials: VendorFinancialSummary;
  counts: VendorCounts;
  assignments: VendorAssignmentRow[];
  deliverables: VendorDeliverableRow[];
  payouts: VendorPayoutRow[];
  activity: VendorActivityItem[];
};

export type { InfluencerStatus as VendorStatus };
