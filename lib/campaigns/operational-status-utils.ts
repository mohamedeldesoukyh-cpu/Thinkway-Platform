import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";

const KNOWN: CampaignLineOperationalStatus[] = [
  "draft",
  "io_generated",
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
