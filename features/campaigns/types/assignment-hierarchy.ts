import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import type {
  CampaignLineAssignmentStatus,
  CampaignLineWorkspace,
  VendorPaymentStatus,
} from "@/features/campaigns/types";

export type AssignmentScheduleChip = {
  id: string;
  sequence_number: number;
  live_date: string | null;
  status: string;
};

export type DeliverableCollectionStatus = "pending" | "partial" | "collected" | null;

export type AssignmentDeliverableHierarchyRow = {
  id: string;
  campaign_line_id: string;
  label: string;
  platform: string;
  deliverable_type: string;
  deliverable_type_label: string;
  quantity: number;
  live_date: string | null;
  revenue_before_vat: number;
  cost_before_vat: number;
  revenue_vat_amount: number;
  revenue_after_vat: number;
  billing_status: AssignmentDeliverableBillingStatus;
  collection_status: DeliverableCollectionStatus;
  invoice_id: string | null;
  invoice_document_number: string | null;
  payout_status: VendorPaymentStatus | null;
  workflow_status: string;
  schedules: AssignmentScheduleChip[];
  remaining_amount: number;
  invoiced_amount: number;
  invoice_eligible: boolean;
  is_synthetic: boolean;
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

export type AssignmentHierarchy = {
  groups: AssignmentHierarchyGroup[];
  currency_code: string;
};
