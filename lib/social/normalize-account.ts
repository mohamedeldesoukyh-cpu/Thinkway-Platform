import type { MetricsSource } from "./enrichment/metrics-status";
import type { PlatformSyncStatus } from "./enrichment/types";
import { normalizeSocialPlatform } from "./normalize-platform";
import {
  buildCanonicalProfileUrl,
  normalizeProfileUrl,
  normalizeUsername,
  type SocialPlatform,
} from "./platforms";
import { resolvePlatformAccountFields } from "./parse-profile-url";

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
  follower_count: number | null;
  following_count: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  is_verified: boolean;
  sync_status: PlatformSyncStatus;
  sync_source: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  metrics_source: MetricsSource;
  metrics_last_synced_at: string | null;
  metrics_is_manual_override: boolean;
};

export function buildNormalizedPlatformAccount(input: {
  platform: string;
  username: string;
  profile_url?: string | null;
  follower_count?: number | null;
  following_count?: number | null;
  engagement_rate?: number | null;
  avg_views?: number | null;
  is_verified?: boolean;
  profile_display_name?: string | null;
  profile_bio?: string | null;
  profile_picture_url?: string | null;
  sync_status?: PlatformSyncStatus;
  sync_source?: string | null;
  last_synced_at?: string | null;
  sync_error?: string | null;
  metrics_source?: MetricsSource;
  metrics_last_synced_at?: string | null;
  metrics_is_manual_override?: boolean;
}): NormalizedPlatformAccount {
  const resolved =
    resolvePlatformAccountFields({
      profile_url: input.profile_url ?? undefined,
      username: input.username,
      platform: input.platform,
    }) ?? null;

  // Never persist mixed-case / alias platforms ("Snapchat", "SC", "IG").
  const platform =
    normalizeSocialPlatform(resolved?.platform) ??
    normalizeSocialPlatform(input.platform);
  if (!platform) {
    throw new Error(`Unsupported platform: ${input.platform}`);
  }

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
    follower_count: input.follower_count ?? null,
    following_count: input.following_count ?? null,
    engagement_rate: input.engagement_rate ?? null,
    avg_views: input.avg_views ?? null,
    is_verified: input.is_verified ?? false,
    sync_status: input.sync_status ?? "manual",
    sync_source: input.sync_source ?? null,
    last_synced_at: input.last_synced_at ?? null,
    sync_error: input.sync_error ?? null,
    metrics_source: input.metrics_source ?? "unavailable",
    metrics_last_synced_at: input.metrics_last_synced_at ?? null,
    metrics_is_manual_override: input.metrics_is_manual_override ?? false,
  };
}
