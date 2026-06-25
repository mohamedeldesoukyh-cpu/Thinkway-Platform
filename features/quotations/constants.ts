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
  cost_gp_pct: "Cost + GP%",
  cost_revenue: "Cost + Revenue",
  cost_gp_value: "Cost + GP Value",
};

export const QUOTATIONS_LIST_PATH = "/discovery/quotations";

export function quotationDetailPath(id: string): string {
  return `${QUOTATIONS_LIST_PATH}/${id}`;
}
