import {
  avatarStorageQualityRank,
  primaryAvatarDisplayPlatform,
  sortPlatformsStable,
} from "@/lib/creators/creator-centric";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { pickPrimaryPlatformAccount } from "@/lib/discovery/profile-url";
import { isDisplayableAvatarUrl, isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type CreatorProfileSource = {
  displayName: string;
  avatarUrl?: string | null;
  platform?: string | null;
  /** All linked platforms — when length > 1, UI shows multi-platform badges instead of `platform` only. */
  linkedPlatforms?: string[];
  handle?: string | null;
  profile_url?: string | null;
  isVerified?: boolean;
  /** ISO 3166-1 alpha-2 — used when avatar badge shows country flag. */
  countryCode?: string | null;
};

export function linkedPlatformsFromCreator(
  creator: UnifiedCreatorResult
): string[] {
  return sortPlatformsStable(creator.platforms).map((account) =>
    canonicalPlatformKey(account.platform)
  );
}

function pickBestAvatarCandidate(
  candidates: Array<string | null | undefined>
): string | null {
  let best: string | null = null;
  let bestUsable = false;
  let bestRank = -1;

  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (!url || !isDisplayableAvatarUrl(url)) continue;
    const usable = isUsableAvatarUrl(url);
    const rank = avatarStorageQualityRank(url);
    if (
      !best ||
      (usable && !bestUsable) ||
      (usable === bestUsable && rank > bestRank)
    ) {
      best = url;
      bestUsable = usable;
      bestRank = rank;
    }
  }

  return best;
}

function resolveUnifiedCreatorAvatarUrl(creator: UnifiedCreatorResult): string | null {
  return pickBestAvatarCandidate([
    creator.primaryAvatarUrl,
    creator.profile_image_url,
    ...sortPlatformsStable(creator.platforms).map((account) => account.profile_picture_url),
  ]);
}

export function creatorProfileSourceFromUnified(
  creator: UnifiedCreatorResult
): CreatorProfileSource {
  const metricsPlatform =
    creator.platforms.find((p) => p.id === creator.default_metrics_platform_account_id) ??
    sortPlatformsStable(creator.platforms)[0];
  const primaryAvatarUrl = resolveUnifiedCreatorAvatarUrl(creator);
  const avatarPlatform =
    primaryAvatarDisplayPlatform(creator.primaryAvatarSource ?? null, primaryAvatarUrl) ??
    metricsPlatform?.platform ??
    null;
  const avatarPlatformAccount =
    avatarPlatform != null
      ? creator.platforms.find(
          (p) => canonicalPlatformKey(p.platform) === canonicalPlatformKey(avatarPlatform)
        )
      : null;
  const linkedPlatforms = linkedPlatformsFromCreator(creator);

  return {
    displayName: formatCreatorDisplayName(creator.display_name),
    avatarUrl: primaryAvatarUrl,
    platform: linkedPlatforms.length === 1 ? linkedPlatforms[0]! : null,
    linkedPlatforms,
    handle: metricsPlatform?.handle ?? null,
    profile_url:
      avatarPlatformAccount?.profile_url ?? metricsPlatform?.profile_url ?? null,
    isVerified: creator.is_platform_verified,
    countryCode:
      creator.country_code ??
      metricsPlatform?.audience_country ??
      creator.estimated_country ??
      null,
  };
}

export function creatorProfileSourceFromPlatformAccount(
  displayName: string,
  account: {
    platform: string;
    handle: string;
    profile_url?: string | null;
    profile_picture_url?: string | null;
  } | null | undefined,
  options?: { avatarUrl?: string | null; isVerified?: boolean }
): CreatorProfileSource {
  return {
    displayName: formatCreatorDisplayName(displayName),
    avatarUrl: options?.avatarUrl ?? account?.profile_picture_url ?? null,
    platform: account?.platform,
    handle: account?.handle,
    profile_url: account?.profile_url,
    isVerified: options?.isVerified,
  };
}

export function creatorProfileSourceFromAccounts(
  displayName: string,
  accounts: Array<{
    platform: string;
    handle: string;
    profile_url?: string | null;
    profile_picture_url?: string | null;
    is_primary?: boolean | null;
  }> | null | undefined,
  options?: { avatarUrl?: string | null; isVerified?: boolean }
): CreatorProfileSource {
  const primary = pickPrimaryPlatformAccount(accounts ?? []);
  return creatorProfileSourceFromPlatformAccount(displayName, primary, options);
}
