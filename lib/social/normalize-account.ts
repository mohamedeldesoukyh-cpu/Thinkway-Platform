import {
  buildCanonicalProfileUrl,
  normalizeProfileUrl,
  normalizeUsername,
  type SocialPlatform,
} from "./platforms";
import { resolvePlatformAccountFields } from "./parse-profile-url";
import type { PlatformSyncStatus } from "./enrichment/types";

export type NormalizedPlatformAccount = {
  platform: SocialPlatform;
  username: string;
  handle: string;
  normalized_username: string;
  profile_url: string | null;
  normalized_profile_url: string | null;
  profile_display_name: string | null;
  profile_bio: string | null;
  profile_picture_url: string | null;
  follower_count: number;
  following_count: number;
  engagement_rate: number | null;
  avg_views: number;
  is_verified: boolean;
  sync_status: PlatformSyncStatus;
  sync_source: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
};

export function buildNormalizedPlatformAccount(input: {
  platform: string;
  username: string;
  profile_url?: string | null;
  follower_count?: number;
  following_count?: number;
  engagement_rate?: number | null;
  avg_views?: number;
  is_verified?: boolean;
  profile_display_name?: string | null;
  profile_bio?: string | null;
  profile_picture_url?: string | null;
  sync_status?: PlatformSyncStatus;
  sync_source?: string | null;
  last_synced_at?: string | null;
  sync_error?: string | null;
}): NormalizedPlatformAccount {
  const resolved =
    resolvePlatformAccountFields({
      profile_url: input.profile_url ?? undefined,
      username: input.username,
      platform: input.platform,
    }) ?? null;

  const platform = (resolved?.platform ?? input.platform) as SocialPlatform;
  const username = resolved?.username ?? input.username.trim().replace(/^@+/, "");
  const normalized_username = normalizeUsername(username);
  const profile_url =
    resolved?.profile_url ??
    (input.profile_url?.trim() || buildCanonicalProfileUrl(platform, username));
  const normalized_profile_url = profile_url
    ? normalizeProfileUrl(profile_url)
    : null;

  return {
    platform,
    username,
    handle: username,
    normalized_username,
    profile_url,
    normalized_profile_url,
    profile_display_name: input.profile_display_name ?? null,
    profile_bio: input.profile_bio ?? null,
    profile_picture_url: input.profile_picture_url ?? null,
    follower_count: input.follower_count ?? 0,
    following_count: input.following_count ?? 0,
    engagement_rate: input.engagement_rate ?? null,
    avg_views: input.avg_views ?? 0,
    is_verified: input.is_verified ?? false,
    sync_status: input.sync_status ?? "manual",
    sync_source: input.sync_source ?? null,
    last_synced_at: input.last_synced_at ?? null,
    sync_error: input.sync_error ?? null,
  };
}
