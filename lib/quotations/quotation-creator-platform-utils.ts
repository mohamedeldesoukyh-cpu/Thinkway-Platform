import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { QuotationCreatorPlatformOption } from "@/features/quotations/actions";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  deliverableTypeValues,
  platformsFromSelectedPostTypes,
} from "@/lib/quotations/quotation-deliverable-types";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";

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

/**
 * Union of platforms for a creator group header: linked accounts, line platforms,
 * and every platform implied by option deliverable types (IG Reel + TT Video → both).
 */
export function unionQuotationCreatorGroupPlatforms(
  items: readonly QuotationItemRow[],
  extraPlatforms: readonly string[] = []
): string[] {
  const found = new Set<string>();

  const add = (raw: string | null | undefined) => {
    const key = raw?.trim() ? canonicalPlatformKey(raw) : "";
    if (key) found.add(key);
  };

  for (const platform of extraPlatforms) add(platform);

  for (const item of items) {
    add(item.platform);
    for (const platform of item.creator_profile_source?.linkedPlatforms ?? []) {
      add(platform);
    }
    for (const deliverable of item.deliverables ?? []) {
      const raw = deliverable.platform?.trim();
      if (raw) {
        for (const part of raw.split(",")) add(part);
      }
      for (const platform of platformsFromSelectedPostTypes(
        deliverableTypeValues(deliverable)
      )) {
        add(platform);
      }
    }
  }

  return sortPlatformsStable([...found].map((platform) => ({ platform }))).map(
    (entry) => entry.platform
  );
}
