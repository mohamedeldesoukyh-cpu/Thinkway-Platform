import {
  primaryAvatarDisplayPlatform,
  sortPlatformsStable,
} from "@/lib/creators/creator-centric";
import { pickPrimaryPlatformAccount } from "@/lib/discovery/profile-url";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type CreatorProfileSource = {
  displayName: string;
  avatarUrl?: string | null;
  platform?: string | null;
  handle?: string | null;
  profile_url?: string | null;
  isVerified?: boolean;
  /** ISO 3166-1 alpha-2 — used when avatar badge shows country flag. */
  countryCode?: string | null;
};

export function creatorProfileSourceFromUnified(
  creator: UnifiedCreatorResult
): CreatorProfileSource {
  const metricsPlatform =
    creator.platforms.find((p) => p.id === creator.default_metrics_platform_account_id) ??
    sortPlatformsStable(creator.platforms)[0];
  const primaryAvatarUrl = creator.primaryAvatarUrl ?? creator.profile_image_url;
  const avatarPlatform =
    primaryAvatarDisplayPlatform(creator.primaryAvatarSource ?? null, primaryAvatarUrl) ??
    metricsPlatform?.platform ??
    null;
  return {
    displayName: creator.display_name,
    avatarUrl: primaryAvatarUrl,
    platform: avatarPlatform,
    handle: metricsPlatform?.handle ?? null,
    profile_url: metricsPlatform?.profile_url ?? null,
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
    displayName,
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
