import type { SocialPlatform } from "../platforms";

export type PlatformSyncStatus =
  | "pending"
  | "synced"
  | "partial"
  | "failed"
  | "manual";

export type EnrichmentResult = {
  display_name: string | null;
  bio: string | null;
  profile_picture_url: string | null;
  follower_count: number | null;
  following_count: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  is_verified: boolean | null;
  audience_country: string | null;
  sync_status: PlatformSyncStatus;
  sync_source: string;
  sync_error: string | null;
  messages: string[];
};

export type EnrichmentContext = {
  platform: SocialPlatform;
  username: string;
  profile_url: string;
};

export interface ProfileEnrichmentProvider {
  readonly id: string;
  supports(context: EnrichmentContext): boolean;
  enrich(context: EnrichmentContext): Promise<Partial<EnrichmentResult>>;
}

export function mergeEnrichment(
  base: EnrichmentResult,
  patch: Partial<EnrichmentResult>
): EnrichmentResult {
  return {
    display_name: patch.display_name ?? base.display_name,
    bio: patch.bio ?? base.bio,
    profile_picture_url: patch.profile_picture_url ?? base.profile_picture_url,
    follower_count: patch.follower_count ?? base.follower_count,
    following_count: patch.following_count ?? base.following_count,
    engagement_rate: patch.engagement_rate ?? base.engagement_rate,
    avg_views: patch.avg_views ?? base.avg_views,
    is_verified: patch.is_verified ?? base.is_verified,
    audience_country: patch.audience_country ?? base.audience_country,
    sync_status: patch.sync_status ?? base.sync_status,
    sync_source: patch.sync_source ?? base.sync_source,
    sync_error: patch.sync_error ?? base.sync_error,
    messages: [...base.messages, ...(patch.messages ?? [])],
  };
}

export function emptyEnrichment(syncSource = "manual"): EnrichmentResult {
  return {
    display_name: null,
    bio: null,
    profile_picture_url: null,
    follower_count: null,
    following_count: null,
    engagement_rate: null,
    avg_views: null,
    is_verified: null,
    audience_country: null,
    sync_status: "manual",
    sync_source: syncSource,
    sync_error: null,
    messages: [],
  };
}
