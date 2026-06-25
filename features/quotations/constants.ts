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
  cost_revenue: "Cost + Revenue",
  cost_gp_value: "Cost + GP Value",
};

/** Default GP% target for healthy/orange warning styling in the quotation workspace. */
export const DEFAULT_GP_TARGET_PCT = 25;

export const CALCULATION_MODE_LABELS: Record<"markup" | "margin", string> = {
  markup: "Markup %",
  margin: "GP Margin %",
};

export const QUOTATIONS_LIST_PATH = "/discovery/quotations";

export function quotationDetailPath(id: string): string {
  return `${QUOTATIONS_LIST_PATH}/${id}`;
}
