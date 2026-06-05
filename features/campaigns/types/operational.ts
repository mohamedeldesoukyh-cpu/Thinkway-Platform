export type CampaignLineOperationalStatus =
  | "draft"
  | "io_generated"
  | "io_revised"
  | "locked"
  | "moved_to_billing"
  | "partially_invoiced"
  | "invoiced"
  | "reopened"
  | "closed";

const INVOICE_ELIGIBLE_OPERATIONAL: ReadonlySet<CampaignLineOperationalStatus> =
  new Set(["io_generated", "io_revised"]);

export function isInvoiceEligibleOperationalStatus(
  status: CampaignLineOperationalStatus
): boolean {
  return INVOICE_ELIGIBLE_OPERATIONAL.has(status);
}

/** Map stored DB status to user-facing Ops badge (never "Invoiced"). */
export function operationalStatusForOpsBadge(
  status: CampaignLineOperationalStatus | string
): CampaignLineOperationalStatus {
  const key = status as CampaignLineOperationalStatus;
  if (key === "invoiced" || key === "partially_invoiced") return "locked";
  if (key === "reopened") return "io_revised";
  if (key === "moved_to_billing") return "io_generated";
  return key;
}
