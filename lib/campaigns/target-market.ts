import { METADATA_TARGET_MARKET_KEY } from "@/lib/campaigns/constants";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";

/** Read campaign-level target market from header metadata (ISO code or free text). */
export function readCampaignTargetMarket(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const value = metadata?.[METADATA_TARGET_MARKET_KEY];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Display label for CIO / Overview (e.g. AE → United Arab Emirates). */
export function formatCampaignTargetMarketLabel(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const byCode = COUNTRY_OPTIONS.find((option) => option.value === trimmed);
  if (byCode) return byCode.label;
  const byLabel = COUNTRY_OPTIONS.find(
    (option) => option.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (byLabel) return byLabel.label;
  return trimmed;
}

export function resolveCampaignTargetMarketDisplay(input: {
  campaignMetadata?: Record<string, unknown> | null;
  clientCountry?: string | null;
  fallback?: string | null;
}): string {
  return (
    formatCampaignTargetMarketLabel(
      readCampaignTargetMarket(input.campaignMetadata)
    ) ||
    formatCampaignTargetMarketLabel(input.clientCountry) ||
    input.clientCountry?.trim() ||
    input.fallback?.trim() ||
    "—"
  );
}
