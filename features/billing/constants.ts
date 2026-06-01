import type {
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

export const AGING_BUCKET_LABELS = {
  current: "Current",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "90_plus": "90+ days",
} as const;

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
