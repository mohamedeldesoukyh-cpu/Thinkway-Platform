import type { CommercialInputMode, QuotationStatus } from "@/types/database";

/** Discovery permission slugs gate quotations (shared with shortlists). */
export const QUOTATION_PERMISSIONS = {
  write: "discovery.write",
  read: "discovery.read",
  admin: "discovery.admin",
} as const;

export const QUOTATION_STATUSES: QuotationStatus[] = [
  "draft",
  "under_review",
  "approved",
  "sent",
  "accepted",
  "rejected",
  "cancelled",
  "archived",
];

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const COMMERCIAL_INPUT_MODE_LABELS: Record<CommercialInputMode, string> = {
  cost_markup_pct: "Cost + Markup%",
  cost_gp_pct: "Cost + GP Margin%",
  cost_revenue: "Cost + Client cost",
  cost_gp_value: "Cost + GP Value",
};

/** Client-facing labels for quotation revenue (agency revenue = client cost). */
export const QUOTATION_CLIENT_LABELS = {
  clientCost: "Client cost",
  clientCostEgp: "Client cost EGP",
  totalClientCost: "Total client cost",
  clientInvestment: "Client investment",
  agencyFee: "Agency fee (AF)",
  agencyFeePct: "AF %",
  totalAgencyFee: "Total agency fee",
  totalAgencyMargin: "Total agency margin",
  lumpSumCost: "Lump sum cost",
  totalCost: "Total cost",
} as const;

/** Default GP% target for healthy/warning styling in the quotation workspace. */
export const DEFAULT_GP_TARGET_PCT = 25;

/** GP% below this threshold uses danger styling. */
export const GP_DANGER_THRESHOLD_PCT = 15;

/** Default quotation validity window from issue date. */
export const DEFAULT_VALIDITY_DAYS = 15;

export const QUOTATION_VERSION_PRESETS = ["v1.0", "v1.1", "v2.0"] as const;

export const QUOTATION_DEPARTMENTS = [
  "Influencer Marketing",
  "Account Management",
  "Strategy",
  "Operations",
] as const;

export const CALCULATION_MODE_LABELS: Record<"markup" | "margin", string> = {
  markup: "Markup %",
  margin: "GP Margin %",
};

export const QUOTATIONS_LIST_PATH = "/discovery/quotations";

export function quotationDetailPath(id: string): string {
  return `${QUOTATIONS_LIST_PATH}/${id}`;
}
