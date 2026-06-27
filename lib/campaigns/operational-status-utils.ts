import type { CampaignLineOperationalStatus } from "@/lib/domains/campaign/operational-utils";
import { operationalStatusForOpsBadge } from "@/lib/domains/campaign/operational-utils";

const KNOWN: CampaignLineOperationalStatus[] = [
  "draft",
  "io_generated",
  "io_revised",
  "locked",
  "moved_to_billing",
  "partially_invoiced",
  "invoiced",
  "reopened",
  "closed",
];

export function normalizeOperationalStatus(
  status: CampaignLineOperationalStatus | string | null | undefined
): CampaignLineOperationalStatus {
  const key = (status ?? "draft") as CampaignLineOperationalStatus;
  return KNOWN.includes(key) ? key : "draft";
}

/** Ops column display status — never surfaces legacy invoiced/reopened labels. */
export function normalizeOperationalStatusForOpsBadge(
  status: CampaignLineOperationalStatus | string | null | undefined
): CampaignLineOperationalStatus {
  return operationalStatusForOpsBadge(normalizeOperationalStatus(status));
}

/**
 * Maps UI/canonical operational labels to Postgres campaign_line_operational_status enum.
 * DB: draft | io_generated | partially_invoiced | invoiced | reopened | moved_to_billing | closed
 */
export function operationalStatusForDb(
  status: CampaignLineOperationalStatus | string | null | undefined
): CampaignLineOperationalStatus {
  const normalized = normalizeOperationalStatus(status);
  if (normalized === "locked") return "invoiced";
  if (normalized === "io_revised") return "reopened";
  return normalized;
}
