import type {
  AssignmentDeliverableBillingStatus,
  CampaignLineBillingStatus,
  CollectionStatus,
  FinancialApprovalStage,
} from "./types";

export const BILLING_STATUS_OPTIONS: {
  value: CampaignLineBillingStatus;
  label: string;
}[] = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "moved_to_billing", label: "Moved to billing" },
  { value: "partially_invoiced", label: "Partially invoiced" },
  { value: "invoiced", label: "Invoiced" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
];

export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  pending: "Pending",
  partial: "Partial",
  collected: "Collected",
  overdue: "Overdue",
  written_off: "Written off",
};

export { AGING_BUCKET_LABELS } from "@/lib/collections/aging";

export const FINANCIAL_APPROVAL_STAGE_LABELS: Record<
  FinancialApprovalStage,
  string
> = {
  campaign_manager: "Campaign Manager",
  finance: "Finance",
  cfo_admin: "CFO / Admin",
};

export const FINANCIAL_APPROVAL_CHAIN: FinancialApprovalStage[] = [
  "campaign_manager",
  "finance",
  "cfo_admin",
];

export function labelForBillingStatus(status: CampaignLineBillingStatus): string {
  return (
    BILLING_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
  );
}

export const DELIVERABLE_BILLING_STATUS_LABELS: Record<
  AssignmentDeliverableBillingStatus,
  string
> = {
  draft: "Draft",
  ready_to_invoice: "Ready to invoice",
  partially_invoiced: "Partially invoiced",
  invoiced: "Invoiced",
  partially_collected: "Partially collected",
  collected: "Collected",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

export function labelForDeliverableBillingStatus(
  status: AssignmentDeliverableBillingStatus
): string {
  return DELIVERABLE_BILLING_STATUS_LABELS[status] ?? status;
}
