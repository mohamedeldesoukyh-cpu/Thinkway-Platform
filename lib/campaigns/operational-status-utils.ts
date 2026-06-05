import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { operationalStatusForOpsBadge } from "@/features/campaigns/types/operational";

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
