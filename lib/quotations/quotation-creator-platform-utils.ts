import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { QuotationCreatorPlatformOption } from "@/features/quotations/actions";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

/** Platforms offered when a manual creator has no linked profile accounts. */
export const QUOTATION_MANUAL_CREATOR_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
  "facebook",
] as const;

export function isManualQuotationCreator(
  item: Pick<QuotationItemRow, "influencer_id" | "profile_id" | "unified_id">
): boolean {
  return !item.influencer_id && !item.profile_id && !item.unified_id;
}

export function bootstrapManualCreatorPlatformOptions(): QuotationCreatorPlatformOption[] {
  return QUOTATION_MANUAL_CREATOR_PLATFORMS.map((platform) => ({
    platform,
    handle: "",
    followers: null,
    engagement_rate: null,
  }));
}

export function mergeCreatorPlatformOptions(
  ...sources: QuotationCreatorPlatformOption[][]
): QuotationCreatorPlatformOption[] {
  const map = new Map<string, QuotationCreatorPlatformOption>();
  for (const list of sources) {
    for (const option of list) {
      const raw = option.platform?.trim();
      if (!raw) continue;
      const key = canonicalPlatformKey(raw);
      if (!map.has(key)) {
        map.set(key, { ...option, platform: key });
      }
    }
  }
  return [...map.values()];
}

export function bootstrapPlatformOptionsFromItem(
  item: QuotationItemRow
): QuotationCreatorPlatformOption[] {
  const source = item.creator_profile_source;
  const linked = source?.linkedPlatforms ?? [];
  if (linked.length > 0) {
    return linked.map((platform) => ({
      platform: canonicalPlatformKey(platform),
      handle: source?.handle ?? item.handle ?? "",
      followers: item.followers,
      engagement_rate: item.engagement_rate,
    }));
  }
  if (item.platform) {
    return [
      {
        platform: canonicalPlatformKey(item.platform),
        handle: item.handle ?? "",
        followers: item.followers,
        engagement_rate: item.engagement_rate,
      },
    ];
  }
  return [];
}
