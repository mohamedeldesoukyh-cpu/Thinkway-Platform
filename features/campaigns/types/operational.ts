export type CampaignLineOperationalStatus =
  | "draft"
  | "io_generated"
  | "moved_to_billing"
  | "partially_invoiced"
  | "invoiced"
  | "reopened"
  | "closed";

const INVOICE_ELIGIBLE_OPERATIONAL: ReadonlySet<CampaignLineOperationalStatus> =
  new Set(["io_generated", "partially_invoiced", "reopened"]);

export function isInvoiceEligibleOperationalStatus(
  status: CampaignLineOperationalStatus
): boolean {
  return INVOICE_ELIGIBLE_OPERATIONAL.has(status);
}
