import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { authorAvatarFromSyncLogSummary } from "@/lib/performance/apify-author-avatar";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";

export type PublicationRecord = Partial<{
  id: string;
  campaign_header_id: string;
  campaign_line_id: string | null;
  assignment_deliverable_id: string | null;
  assignment_post_schedule_id: string | null;
  influencer_id: string | null;
  platform: string;
  publication_type: string;
  content_url: string | null;
  publication_date: string | null;
  status: string;
  assignee_id: string | null;
  caption: string | null;
  hashtags: string | null;
  mentions: string | null;
  hashtag_count: number | null;
  mention_count: number | null;
  thumbnail_url: string | null;
  screenshot_url: string | null;
  screenshot_captured_at: string | null;
  screenshot_source: string | null;
  notes: string | null;
  auto_detected: boolean;
  created_at: string;
  updated_at: string | null;
  last_synced_at: string | null;
  api_sync_status: string | null;
  detection_source: string | null;
  sync_status: string | null;
  sync_source: string | null;
  metrics_refresh_status: string | null;
  metrics_refresh_attempted_at: string | null;
  metrics_collection_source: string | null;
  metrics_provider: string | null;
  metrics_confidence: number | null;
  engagements: number | null;
  impressions: number | null;
  impressions_source: string | null;
  actual_impressions: number | null;
  forecast_impressions: number | null;
  reach: number | null;
  reach_source: string | null;
  actual_reach: number | null;
  forecast_reach: number | null;
  views: number | null;
  unique_views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  plays: number | null;
  watch_time_seconds: number | null;
  average_watch_time_seconds: number | null;
  completion_rate: number | null;
  engagement_rate: number | null;
  engagement_rate_method: string | null;
  view_rate: number | null;
  cpm: number | null;
  cpv: number | null;
  cpe: number | null;
  cpc: number | null;
  sentiment_score: number | null;
  brand_safety_score: number | null;
  authenticity_score: number | null;
  cost: number | null;
  currency: string | null;
  engagement_views: number | null;
  engagement_likes: number | null;
  engagement_comments: number | null;
  engagement_shares: number | null;
}>;

export async function fetchCampaignPublicationCount(
  supabase: SupabaseClient,
  campaignId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("campaign_publications")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignId);

  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function countCampaignPublications(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<number> {
  return fetchCampaignPublicationCount(supabase, campaignHeaderId);
}

export async function fetchCampaignPublicationRows(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  selectList: string
) {
  return supabase
    .from("campaign_publications")
    .select(selectList)
    .eq("campaign_header_id", campaignHeaderId)
    .order("publication_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
}

export async function fetchInfluencerMetaForPublications(
  supabase: SupabaseClient,
  influencerIds: string[]
): Promise<{
  names: Map<string, string>;
  avatars: Map<
    string,
    {
      creatorProfileImage: string | null;
      influencerAvatar: string | null;
      platformPicture: string | null;
      followerCount: number | null;
      handle: string | null;
      profileUrl: string | null;
    }
  >;
}> {
  const names = new Map<string, string>();
  const avatars = new Map<
    string,
    {
      creatorProfileImage: string | null;
      influencerAvatar: string | null;
      platformPicture: string | null;
      followerCount: number | null;
      handle: string | null;
      profileUrl: string | null;
    }
  >();
  if (influencerIds.length === 0) return { names, avatars };

  const { data: influencers, error: influencerError } = await supabase
    .from("influencers")
    .select("id, display_name, profile_id, metadata")
    .in("id", influencerIds);

  if (influencerError) {
    console.warn("[performance] influencer names query failed", influencerError.message);
  } else {
    for (const row of influencers ?? []) {
      names.set(row.id, row.display_name);
      const metadata = row.metadata as Record<string, unknown> | null;
      const metadataProfileImage =
        typeof metadata?.profile_image_url === "string" ? metadata.profile_image_url : null;
      const influencerAvatar =
        typeof metadata?.avatar_url === "string" ? metadata.avatar_url : null;
      avatars.set(`${row.id}:`, {
        creatorProfileImage: metadataProfileImage,
        influencerAvatar,
        platformPicture: null,
        followerCount: null,
        handle: null,
        profileUrl: null,
      });
    }
  }

  const profileIds = (influencers ?? [])
    .map((row) => row.profile_id)
    .filter((id): id is string => id != null);

  if (profileIds.length > 0) {
    const { data: creators, error: creatorError } = await supabase
      .from("discovered_profiles")
      .select("id, profile_image_url")
      .in("id", profileIds);

    if (creatorError) {
      console.warn("[performance] creator profile images query failed", creatorError.message);
    } else {
      const imageByProfileId = new Map(
        (creators ?? []).map((c) => [c.id, c.profile_image_url as string | null])
      );
      for (const row of influencers ?? []) {
        if (!row.profile_id) continue;
        const image = imageByProfileId.get(row.profile_id) ?? null;
        if (!image) continue;
        const existing = avatars.get(`${row.id}:`) ?? {
          creatorProfileImage: null,
          influencerAvatar: null,
          platformPicture: null,
          followerCount: null,
          handle: null,
          profileUrl: null,
        };
        avatars.set(`${row.id}:`, { ...existing, creatorProfileImage: image });
      }
    }
  }

  const { data: accounts, error: accountError } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, platform, handle, profile_url, profile_picture_url, follower_count")
    .in("influencer_id", influencerIds);

  if (accountError) {
    console.warn("[performance] influencer avatars query failed", accountError.message);
    return { names, avatars };
  }

  for (const account of accounts ?? []) {
    const platformKey = canonicalPlatformKey(account.platform ?? "");
    const key = `${account.influencer_id}:${platformKey}`;
    avatars.set(key, {
      creatorProfileImage: null,
      influencerAvatar: null,
      platformPicture: account.profile_picture_url ?? null,
      followerCount: account.follower_count ?? null,
      handle: account.handle ?? null,
      profileUrl: resolveCreatorProfileUrl({
        platform: platformKey,
        handle: account.handle,
        profile_url: account.profile_url,
      }),
    });

    const base = avatars.get(`${account.influencer_id}:`);
    if (base) {
      avatars.set(`${account.influencer_id}:`, {
        ...base,
        followerCount: base.followerCount ?? account.follower_count ?? null,
      });
    }
  }

  return { names, avatars };
}

export async function fetchApifyAuthorAvatarsFromSyncLogs(
  supabase: SupabaseClient,
  publicationIds: string[]
): Promise<Map<string, string>> {
  const avatars = new Map<string, string>();
  if (publicationIds.length === 0) return avatars;

  const { data, error } = await supabase
    .from("publication_metric_sync_logs")
    .select("publication_id, response_summary, created_at")
    .in("publication_id", publicationIds)
    .eq("provider", "apify")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[performance] apify author avatar sync log query failed", error.message);
    return avatars;
  }

  for (const row of (data ?? []) as Array<{
    publication_id: string;
    response_summary: unknown;
    created_at: string;
  }>) {
    const publicationId = row.publication_id as string;
    if (avatars.has(publicationId)) continue;
    const url = authorAvatarFromSyncLogSummary(row.response_summary);
    if (url) avatars.set(publicationId, url);
  }

  return avatars;
}

export async function updateCampaignPublicationRow(
  supabase: SupabaseClient,
  campaignId: string,
  publicationId: string,
  payload: Record<string, unknown>
) {
  return supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", publicationId)
    .eq("campaign_header_id", campaignId);
}

export async function bulkUpdateCampaignPublicationStatus(
  supabase: SupabaseClient,
  campaignId: string,
  publicationIds: string[],
  status: string
) {
  return supabase
    .from("campaign_publications")
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("campaign_header_id", campaignId)
    .in("id", publicationIds);
}

export async function insertCampaignPublications(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[]
) {
  return supabase.from("campaign_publications").insert(rows as never);
}

export async function deleteCampaignPublicationRow(
  supabase: SupabaseClient,
  campaignId: string,
  publicationId: string
) {
  return supabase
    .from("campaign_publications")
    .delete()
    .eq("id", publicationId)
    .eq("campaign_header_id", campaignId);
}

export async function findCampaignPublicationIdByContentUrl(
  supabase: SupabaseClient,
  campaignId: string,
  contentUrl: string
) {
  return supabase
    .from("campaign_publications")
    .select("id")
    .eq("campaign_header_id", campaignId)
    .eq("content_url", contentUrl)
    .maybeSingle();
}

export async function fetchPublicationMetricSyncLogs(
  supabase: SupabaseClient,
  campaignId: string,
  publicationId: string
) {
  return supabase
    .from("publication_metric_sync_logs")
    .select(
      "id, created_at, provider, status, metrics_refresh_status, message, duration_ms, metrics_snapshot, triggered_by, previous_er, new_er, previous_method, new_method, response_summary"
    )
    .eq("campaign_header_id", campaignId)
    .eq("publication_id", publicationId)
    .order("created_at", { ascending: false })
    .limit(50);
}
