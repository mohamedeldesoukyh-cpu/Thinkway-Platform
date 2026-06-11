import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import type {
  CampaignLineWorkspace,
  VendorPaymentStatus,
} from "@/features/campaigns/types";

export type DeliverableCollectionStatus = "pending" | "partial" | "collected" | null;

/** Level 3 — individual operational post row (assignment_post_schedule). */
export type AssignmentPostOperationalRow = {
  id: string;
  assignment_deliverable_id: string;
  sequence_number: number;
  label: string;
  platform: string;
  deliverable_type: string;
  deliverable_type_label: string;
  live_date: string | null;
  workflow_status: string;
  notes: string | null;
  revenue_per_post: number;
  cost_per_post: number;
  revenue_vat_percent: number;
  revenue_vat_amount: number;
  cost_vat_amount: number;
  billing_status: AssignmentDeliverableBillingStatus;
  collection_status: DeliverableCollectionStatus;
  invoice_id: string | null;
  invoice_document_number: string | null;
  payout_status: VendorPaymentStatus | null;
  is_locked: boolean;
};

/** Level 2 — deliverable rollup row (assignment_deliverables). */
export type AssignmentDeliverableHierarchyRow = {
  id: string;
  campaign_line_id: string;
  sort_order: number;
  label: string;
  platform: string;
  deliverable_type: string;
  deliverable_type_label: string;
  quantity: number;
  unit_cost: number;
  unit_revenue: number;
  live_date: string | null;
  notes: string | null;
  revenue_before_vat: number;
  usage_rights_amount: number;
  agency_fee_percent: number;
  agency_fee_amount: number;
  cost_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_amount: number;
  revenue_after_vat: number;
  cost_vat_amount: number;
  billing_status: AssignmentDeliverableBillingStatus;
  collection_status: DeliverableCollectionStatus;
  invoice_id: string | null;
  invoice_document_number: string | null;
  payout_status: VendorPaymentStatus | null;
  workflow_status: string;
  posts: AssignmentPostOperationalRow[];
  remaining_amount: number;
  invoiced_amount: number;
  invoice_eligible: boolean;
  is_synthetic: boolean;
  is_locked: boolean;
  locked_at: string | null;
  live_ad_date_locked: boolean;
};

export type AssignmentHierarchyRollups = {
  deliverable_count: number;
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  invoiced_value: number;
  remaining_value: number;
  collected_value: number;
};

export type AssignmentHierarchyGroup = {
  line: CampaignLineWorkspace;
  deliverables: AssignmentDeliverableHierarchyRow[];
  rollups: AssignmentHierarchyRollups;
};

/** Campaign-level invoice lifecycle hints for assignment selection (e.g. after ungenerate). */
export type AssignmentHierarchyBillingContext = {
  pending_regeneration_invoice_id: string | null;
  regeneration_status: string | null;
  invoice_status: string | null;
};

export type AssignmentHierarchy = {
  groups: AssignmentHierarchyGroup[];
  currency_code: string;
  billing_context?: AssignmentHierarchyBillingContext;
  /** Set when hierarchy query partially or fully failed — UI should show warning, not crash. */
  load_error?: string | null;
  /** Lines removed during server/client sanitize (bad payload). */
  skipped_line_ids?: string[];
  sanitize_warnings?: string[];
};

/** @deprecated Use AssignmentPostOperationalRow */
export type AssignmentScheduleChip = {
  id: string;
  sequence_number: number;
  live_date: string | null;
  status: string;
};
