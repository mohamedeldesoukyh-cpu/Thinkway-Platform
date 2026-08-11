import {
  avatarStorageQualityRank,
  primaryAvatarDisplayPlatform,
  sortPlatformsStable,
} from "@/lib/creators/creator-centric";
import { creatorRecentPublicationDisplayUrl } from "@/lib/creators/recent-publication-thumb";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  extractEmbeddedCreatorHandle,
  formatCreatorDisplayName,
} from "@/lib/text/decode-html-entities";
import { pickPrimaryPlatformAccount } from "@/lib/discovery/profile-url";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import {
  isDisplayableAvatarUrl,
  isInstagramCdnUrlExpired,
  isUsableAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";
import type { CreatorEnrichmentStatus } from "@/lib/creator-enrichment/types";
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
  /** All creator location countries for multi-flag avatar overlays. */
  countryCodes?: string[] | null;
  /** Thinkway score (0–100) for exact-row star badge. */
  thinkwayScore?: number | null;
  /** Resolved enrichment badge — drives shortlist-style avatar sync glow. */
  enrichmentDisplayStatus?: CreatorEnrichmentStatus | null;
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

function resolvePublicationAvatarFallback(creator: UnifiedCreatorResult): string | null {
  const publications =
    (creator.recent_publications?.length ?? 0) > 0
      ? creator.recent_publications!
      : creator.platforms.flatMap((platform) => platform.recent_publications ?? []);

  for (const publication of publications) {
    const displayUrl = creatorRecentPublicationDisplayUrl(publication);
    if (displayUrl) return displayUrl;
  }

  return null;
}

/**
 * Prefer a usable (non-expired) profile avatar. When the stored CDN is expired —
 * common after enrichment without durable upload — prefer a publication preview
 * URL (has postUrl scrape fallback) over a dead profile CDN that only silhouettes.
 */
function resolveUnifiedCreatorAvatarUrl(creator: UnifiedCreatorResult): string | null {
  const primary = pickBestAvatarCandidate([
    creator.primaryAvatarUrl,
    creator.profile_image_url,
    ...sortPlatformsStable(creator.platforms).map((account) => account.profile_picture_url),
  ]);
  const publicationFallback = resolvePublicationAvatarFallback(creator);

  if (primary && isUsableAvatarUrl(primary)) return primary;

  // Expired IG CDN + working publication preview → show post thumb instead of grey silhouette.
  if (publicationFallback && (!primary || isInstagramCdnUrlExpired(primary))) {
    return publicationFallback;
  }

  // Still pass expired displayable CDN so the avatar proxy can try profileUrl scrape.
  if (primary) return primary;
  return publicationFallback;
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
  const countryCodes = resolveCreatorCountryCodes({
    country_codes: creator.country_codes,
    country_code: creator.country_code,
    estimated_country: creator.estimated_country,
    platformAudienceCountries: creator.platforms.map((platform) => platform.audience_country),
  });

  return {
    displayName: formatCreatorDisplayName(creator.display_name),
    avatarUrl: primaryAvatarUrl,
    platform: linkedPlatforms.length === 1 ? linkedPlatforms[0]! : null,
    linkedPlatforms,
    handle: metricsPlatform?.handle ?? null,
    profile_url:
      avatarPlatformAccount?.profile_url ?? metricsPlatform?.profile_url ?? null,
    isVerified: creator.is_platform_verified,
    countryCode: countryCodes[0] ?? null,
    countryCodes,
    thinkwayScore: creator.thinkway_score ?? null,
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
  const cleanedName = formatCreatorDisplayName(displayName);
  const handle =
    account?.handle?.trim().replace(/^@+/, "") ||
    extractEmbeddedCreatorHandle(displayName) ||
    null;
  return {
    displayName: cleanedName || handle || "Creator",
    avatarUrl: options?.avatarUrl ?? account?.profile_picture_url ?? null,
    platform: account?.platform,
    handle,
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
  const bestAvatar =
    options?.avatarUrl ??
    pickBestAvatarCandidate((accounts ?? []).map((account) => account.profile_picture_url));
  return creatorProfileSourceFromPlatformAccount(displayName, primary, {
    ...options,
    avatarUrl: bestAvatar,
  });
}
