import type { CampaignLineOperationalStatus } from "@/lib/domains/campaign/types";

export type { CampaignLineOperationalStatus } from "@/lib/domains/campaign/types";

const INVOICE_ELIGIBLE_OPERATIONAL: ReadonlySet<CampaignLineOperationalStatus> =
  new Set(["io_generated", "io_revised", "partially_invoiced"]);

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
  if (key === "invoiced") return "locked";
  if (key === "partially_invoiced") return "partially_invoiced";
  if (key === "reopened") return "io_revised";
  if (key === "moved_to_billing") return "io_generated";
  return key;
}
