import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  avatarStorageQualityRank,
  sortPlatformsStable,
} from "@/lib/creators/creator-centric";
import {
  isPositiveNumericMetric,
  normalizeCountryCode,
  resolveCreatorEngagementRate,
  resolveCreatorFollowersCount,
} from "@/lib/creators/creator-display-utils";
import {
  creatorProfileSourceFromUnified,
  type CreatorProfileSource,
} from "@/lib/creators/creator-profile-source";
import { mergeQuotationItemIntoProfileSource } from "@/lib/quotations/quotation-creator-source";
import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { resolveBrowseCreatorProfileImageUrl } from "@/lib/performance/creator-avatar";
import {
  isDisplayableAvatarUrl,
  isUsableAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import type { Database } from "@/types/database";

function firstUsableAvatarUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  let best: string | null = null;
  let bestRank = -1;
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || !isUsableAvatarUrl(trimmed)) continue;
    const rank = avatarStorageQualityRank(trimmed);
    if (!best || rank > bestRank) {
      best = trimmed;
      bestRank = rank;
    }
  }
  if (best) return best;

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isDisplayableAvatarUrl(trimmed)) return trimmed;
  }
  return null;
}

function metadataAvatarUrl(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (typeof metadata?.avatar_url === "string" && metadata.avatar_url.trim()) {
    return metadata.avatar_url.trim();
  }
  if (typeof metadata?.profile_image_url === "string" && metadata.profile_image_url.trim()) {
    return metadata.profile_image_url.trim();
  }
  return null;
}

function resolveMetricsPlatformAccount(
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
) {
  const platforms = sortPlatformsStable(creator.platforms);
  return (
    platforms.find((account) => account.id === creator.default_metrics_platform_account_id) ??
    platforms[0] ??
    null
  );
}

function resolveLineCreatorProfileSource(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): CreatorProfileSource {
  const source = creatorProfileSourceFromUnified(creator);
  const linePlatform = item.platform ? canonicalPlatformKey(item.platform) : null;
  const platformAccount =
    linePlatform != null
      ? creator.platforms.find(
          (account) => canonicalPlatformKey(account.platform) === linePlatform
        )
      : resolveMetricsPlatformAccount(creator);

  const profileUrl =
    resolveCreatorProfileUrl(
      platformAccount
        ? {
            platform: platformAccount.platform,
            handle: platformAccount.handle ?? item.handle,
            profile_url: platformAccount.profile_url,
          }
        : item.platform
          ? {
              platform: item.platform,
              handle: item.handle,
            }
          : null
    ) ??
    source.profile_url ??
    null;

  // Prefer still-usable URLs: skip expired Instagram CDN snapshots on the line
  // when the linked influencer/platform account already has a fresh avatar.
  const platformMetadata =
    (platformAccount?.metadata as Record<string, unknown> | null | undefined) ?? null;
  const browseAvatar = resolveBrowseCreatorProfileImageUrl({
    platform: platformAccount?.platform ?? item.platform,
    platformPictureUrl: platformAccount?.profile_picture_url,
    platformAvatarUrl: metadataAvatarUrl(platformMetadata),
    discoveryProfileImageUrl: creator.profile_image_url,
    influencerAvatarUrl: creator.primaryAvatarUrl ?? source.avatarUrl,
  });
  const avatarUrl =
    firstUsableAvatarUrl(
      source.avatarUrl,
      creator.primaryAvatarUrl,
      creator.profile_image_url,
      ...creator.platforms.map((account) => account.profile_picture_url),
      platformAccount?.profile_picture_url,
      browseAvatar,
      item.profile_image_url
    ) ?? null;

  const linkedPlatforms = source.linkedPlatforms ?? [];
  const platform =
    linePlatform ??
    (linkedPlatforms.length === 1 ? linkedPlatforms[0]! : null);

  return mergeQuotationItemIntoProfileSource(
    {
      ...source,
      displayName:
        source.displayName ||
        formatCreatorDisplayName(item.creator_name) ||
        formatCreatorDisplayName(item.handle) ||
        "Creator",
      avatarUrl,
      profile_url: profileUrl,
      platform,
      linkedPlatforms,
      handle: platformAccount?.handle ?? item.handle ?? source.handle,
      countryCode: source.countryCode ?? normalizeCountryCode(item.country_code) ?? null,
      isVerified: source.isVerified,
    },
    item
  );
}

function resolveLinePlatformAccount(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
) {
  const linePlatform = item.platform ? canonicalPlatformKey(item.platform) : null;
  return linePlatform != null
    ? creator.platforms.find(
        (account) => canonicalPlatformKey(account.platform) === linePlatform
      )
    : resolveMetricsPlatformAccount(creator);
}

function resolveLineFollowers(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): number | null {
  if (isPositiveNumericMetric(item.followers)) return item.followers;
  const platformAccount = resolveLinePlatformAccount(item, creator);
  return (
    resolveCreatorFollowersCount(creator, platformAccount?.platform ?? item.platform) ??
    item.followers ??
    null
  );
}

function resolveLineEngagementRate(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): number | null {
  if (item.engagement_rate != null && Number.isFinite(item.engagement_rate)) {
    return item.engagement_rate;
  }
  const platformAccount = resolveLinePlatformAccount(item, creator);
  return (
    resolveCreatorEngagementRate(creator, platformAccount?.platform ?? item.platform) ??
    item.engagement_rate ??
    null
  );
}

function resolveLineAvatarFields(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): {
  profile_image_url: string | null;
  profile_url: string | null;
  followers: number | null;
  engagement_rate: number | null;
  creator_profile_source: CreatorProfileSource;
} {
  const creatorProfileSource = resolveLineCreatorProfileSource(item, creator);
  return {
    profile_image_url: creatorProfileSource.avatarUrl ?? null,
    profile_url: creatorProfileSource.profile_url ?? null,
    followers: resolveLineFollowers(item, creator),
    engagement_rate: resolveLineEngagementRate(item, creator),
    creator_profile_source: creatorProfileSource,
  };
}

function fallbackAvatarFields(item: QuotationItemRow): {
  profile_image_url: string | null;
  profile_url: string | null;
} {
  const profileUrl = item.platform
    ? resolveCreatorProfileUrl({ platform: item.platform, handle: item.handle })
    : null;
  return {
    profile_image_url: item.profile_image_url ?? null,
    profile_url: item.profile_url ?? profileUrl,
  };
}

export async function enrichQuotationItemsWithCreatorAvatars(
  supabase: SupabaseClient<Database>,
  items: QuotationItemRow[]
): Promise<QuotationItemRow[]> {
  if (items.length === 0) return items;

  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: items.map((item) => item.unified_id),
    influencerIds: items.map((item) => item.influencer_id),
    discoveredProfileIds: items.map((item) => item.profile_id),
  });

  const enriched = items.map((item) => {
    const creator = resolveCreatorFromRefLookup(lookup, item);
    if (!creator) {
      return {
        ...item,
        ...fallbackAvatarFields(item),
        creator_profile_source: null,
      };
    }

    const enrichedFields = resolveLineAvatarFields(item, creator);
    return { ...item, ...enrichedFields };
  });

  await persistQuotationItemAvatars(supabase, enriched, items);
  return enriched;
}

async function persistQuotationItemAvatars(
  supabase: SupabaseClient<Database>,
  enriched: QuotationItemRow[],
  original: QuotationItemRow[]
) {
  const originalById = new Map(original.map((item) => [item.id, item]));

  await Promise.all(
    enriched.map(async (item) => {
      const prev = originalById.get(item.id);
      if (!prev) return;
      const imageChanged = item.profile_image_url && item.profile_image_url !== prev.profile_image_url;
      const urlChanged = item.profile_url && item.profile_url !== prev.profile_url;
      const followersChanged =
        isPositiveNumericMetric(item.followers) && item.followers !== prev.followers;
      const erChanged =
        item.engagement_rate != null &&
        Number.isFinite(item.engagement_rate) &&
        item.engagement_rate !== prev.engagement_rate;
      if (!imageChanged && !urlChanged && !followersChanged && !erChanged) return;

      await supabase
        .from("quotation_items")
        .update({
          profile_image_url: item.profile_image_url,
          profile_url: item.profile_url,
          ...(followersChanged ? { followers: item.followers } : {}),
          ...(erChanged ? { engagement_rate: item.engagement_rate } : {}),
        } as never)
        .eq("id", item.id);
    })
  );
}
