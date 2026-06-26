import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deliverableTypeShortLabel, getPlatformOptionLabel, canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { getCampaignPublicationsSchema } from "@/lib/campaigns/campaign-publications-schema-runtime";
import { CAMPAIGN_PUBLICATIONS_EXPECTED_MIGRATION } from "@/lib/campaigns/campaign-publications-schema";
import {
  createPublicationMediaSignedUrl,
  resolvePublicationMediaDisplayUrl,
} from "@/lib/performance/screenshot-capture/storage";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import {
  isAvatarUrlAllowedForPlatform,
  resolvePublicationCreatorAvatar,
  resolvePublicationEffectivePlatform,
} from "@/lib/performance/creator-avatar";
import { authorAvatarFromSyncLogSummary } from "@/lib/performance/apify-author-avatar";
import { computeEngagementSnapshot } from "@/lib/performance/engagement-rate-engine";
import { traceCampaignRoute, traceCampaignRouteError } from "@/lib/performance/campaign-route-trace";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { sanitizeMetricValue } from "@/lib/performance/metrics-collector/merge-metrics";
import { computeImpressionsForecast } from "@/lib/performance/impressions-forecast-engine";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import {
  deriveCalculatedMetrics,
  formatCompactCount,
  totalEngagements,
  type PerformanceMetricInput,
} from "@/lib/campaigns/performance-calculations";

export type CampaignPublicationRow = {
  id: string;
  campaign_header_id: string;
  campaign_line_id: string | null;
  assignment_deliverable_id: string | null;
  assignment_post_schedule_id: string | null;
  influencer_id: string | null;
  influencer_name: string | null;
  influencer_handle: string | null;
  influencer_profile_url: string | null;
  creator_profile_image_url: string | null;
  influencer_avatar_url: string | null;
  social_profile_picture_url: string | null;
  apify_author_avatar_url: string | null;
  creator_avatar_url: string | null;
  platform: string;
  publication_type: string;
  publication_type_label: string;
  platform_label: string;
  content_url: string | null;
  publication_date: string | null;
  status: string;
  assignee_id: string | null;
  assignee_name: string | null;
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
  sync_status: string | null;
  sync_source: string | null;
  metrics_refresh_status: string | null;
  metrics_refresh_attempted_at: string | null;
  metrics_collection_source: string | null;
  metrics_provider: string | null;
  metrics_confidence: number | null;
  stored_engagements: number | null;
  impressions: number | null;
  impressions_source: string | null;
  actual_impressions: number | null;
  forecast_impressions: number | null;
  forecast_impressions_formula: string | null;
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
  platform_follower_count: number | null;
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
  total_engagements: number;
};

export type CampaignPerformanceSummary = {
  total_publications: number;
  total_reach: number;
  total_actual_reach: number;
  total_forecast_reach: number;
  total_manual_reach: number;
  total_impressions: number;
  total_actual_impressions: number;
  total_forecast_impressions: number;
  total_manual_impressions: number;
  total_views: number;
  total_engagements: number;
  average_engagement_rate: number | null;
  average_cpm: number | null;
  average_cpv: number | null;
  top_creator_name: string | null;
  top_creator_engagements: number;
  currency: string;
};

export type CampaignPerformanceCharts = {
  performance_over_time: Array<{
    date: string;
    views: number;
    engagements: number;
    reach: number;
  }>;
  platform_split: Array<{ platform: string; label: string; count: number; engagements: number }>;
  content_type_split: Array<{ type: string; label: string; count: number }>;
  top_creators_by_engagement: Array<{ name: string; engagements: number; views: number }>;
  reach_by_creator: Array<{ name: string; reach: number }>;
  views_by_publication: Array<{ id: string; label: string; views: number }>;
  engagement_distribution: Array<{ bucket: string; count: number }>;
};

export type CampaignPerformanceBundle = {
  publications: CampaignPublicationRow[];
  summary: CampaignPerformanceSummary;
  charts: CampaignPerformanceCharts;
  sync_health: CampaignMetricsSyncHealth;
  load_error: string | null;
  schema_warnings: string[];
};

type PublicationRecord = Partial<{
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

function emptyCharts(): CampaignPerformanceCharts {
  return {
    performance_over_time: [],
    platform_split: [],
    content_type_split: [],
    top_creators_by_engagement: [],
    reach_by_creator: [],
    views_by_publication: [],
    engagement_distribution: [],
  };
}

function emptySummary(): CampaignPerformanceSummary {
  return {
    total_publications: 0,
    total_reach: 0,
    total_actual_reach: 0,
    total_forecast_reach: 0,
    total_manual_reach: 0,
    total_impressions: 0,
    total_actual_impressions: 0,
    total_forecast_impressions: 0,
    total_manual_impressions: 0,
    total_views: 0,
    total_engagements: 0,
    average_engagement_rate: null,
    average_cpm: null,
    average_cpv: null,
    top_creator_name: null,
    top_creator_engagements: 0,
    currency: "USD",
  };
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapPublicationRecord(
  r: PublicationRecord,
  influencerNames: Map<string, string>,
  influencerAvatars: Map<
    string,
    {
      creatorProfileImage: string | null;
      influencerAvatar: string | null;
      platformPicture: string | null;
      followerCount: number | null;
      handle: string | null;
      profileUrl: string | null;
    }
  >,
  apifyAuthorAvatars: Map<string, string>
): CampaignPublicationRow {
  const platformKey = resolvePublicationEffectivePlatform({
    platform: r.platform,
    publication_type: r.publication_type,
    content_url: r.content_url,
  });
  const views =
    sanitizeMetricValue(r.views) ?? sanitizeMetricValue(r.engagement_views);
  const likes =
    sanitizeMetricValue(r.likes) ?? sanitizeMetricValue(r.engagement_likes);
  const comments =
    sanitizeMetricValue(r.comments) ?? sanitizeMetricValue(r.engagement_comments);
  const shares =
    sanitizeMetricValue(r.shares) ?? sanitizeMetricValue(r.engagement_shares);
  const impressions = num(r.impressions);
  const impressions_source = r.impressions_source ?? null;
  const actual_impressions = num(r.actual_impressions);
  const forecast_impressions = num(r.forecast_impressions);
  const reach = num(r.reach);
  const reach_source = r.reach_source ?? null;
  const actual_reach = num(r.actual_reach);
  const forecast_reach = num(r.forecast_reach);
  const saves = num(r.saves);
  const clicks = num(r.clicks);
  const cost = num(r.cost);

  const platformAvatarMeta = r.influencer_id
    ? influencerAvatars.get(`${r.influencer_id}:${platformKey}`)
    : undefined;
  const genericAvatarMeta = r.influencer_id
    ? influencerAvatars.get(`${r.influencer_id}:`)
    : undefined;
  const platformFollowerCount = platformAvatarMeta?.followerCount ?? null;

  let engagementSnapshot;
  try {
    engagementSnapshot = computeEngagementSnapshot({
      views,
      reach,
      likes,
      comments,
      shares,
      saves,
      followers: platformFollowerCount,
      manualEngagementRate:
        r.engagement_rate_method === "manual" ? num(r.engagement_rate) : null,
    });
  } catch (error) {
    traceCampaignRouteError("publications:engagement-snapshot", error, {
      publicationId: r.id,
      platform: platformKey,
    });
    throw error;
  }

  const storedEr = num(r.engagement_rate);
  const storedMethod = r.engagement_rate_method ?? null;
  const engagement_rate =
    storedEr ?? engagementSnapshot.engagement_rate;
  const engagement_rate_method =
    storedMethod ?? engagementSnapshot.engagement_rate_method;

  const metricInput: PerformanceMetricInput = {
    impressions,
    reach,
    views,
    likes,
    comments,
    shares,
    saves,
    clicks,
    cost,
    followers: platformFollowerCount,
  };

  const derived = deriveCalculatedMetrics(metricInput);
  const engagements = engagementSnapshot.engagements;

  const creatorProfileImage = genericAvatarMeta?.creatorProfileImage ?? null;
  const influencerAvatar = genericAvatarMeta?.influencerAvatar ?? null;
  const rawSocialProfilePicture = platformAvatarMeta?.platformPicture ?? null;
  const socialProfilePicture =
    rawSocialProfilePicture &&
    isUsableAvatarUrl(rawSocialProfilePicture) &&
    isAvatarUrlAllowedForPlatform(platformKey, rawSocialProfilePicture)
      ? rawSocialProfilePicture
      : null;

  if (
    process.env.NODE_ENV === "development" &&
    rawSocialProfilePicture &&
    !socialProfilePicture &&
    platformKey !== "instagram"
  ) {
    traceCampaignRoute("publications:avatar:blocked-ig-bleed", {
      publicationId: r.id,
      platform: platformKey,
      influencerId: r.influencer_id,
    });
  }

  const rawApifyAuthorAvatar = r.id ? (apifyAuthorAvatars.get(r.id) ?? null) : null;
  const apifyAuthorAvatar =
    rawApifyAuthorAvatar &&
    isUsableAvatarUrl(rawApifyAuthorAvatar) &&
    isAvatarUrlAllowedForPlatform(platformKey, rawApifyAuthorAvatar)
      ? rawApifyAuthorAvatar
      : null;

  return {
    id: r.id!,
    campaign_header_id: r.campaign_header_id!,
    campaign_line_id: r.campaign_line_id ?? null,
    assignment_deliverable_id: r.assignment_deliverable_id ?? null,
    assignment_post_schedule_id: r.assignment_post_schedule_id ?? null,
    influencer_id: r.influencer_id ?? null,
    influencer_name: r.influencer_id ? (influencerNames.get(r.influencer_id) ?? null) : null,
    influencer_handle: platformAvatarMeta?.handle ?? null,
    influencer_profile_url: platformAvatarMeta?.profileUrl ?? null,
    creator_profile_image_url: creatorProfileImage,
    influencer_avatar_url: influencerAvatar,
    social_profile_picture_url: socialProfilePicture,
    apify_author_avatar_url: apifyAuthorAvatar,
    creator_avatar_url: resolvePublicationCreatorAvatar({
      platform: platformKey,
      publication_type: r.publication_type,
      content_url: r.content_url,
      creator_profile_image_url: creatorProfileImage,
      influencer_avatar_url: influencerAvatar,
      platform_profile_picture_url: socialProfilePicture,
      apify_author_avatar_url: apifyAuthorAvatar,
    }),
    platform: platformKey,
    publication_type: r.publication_type ?? "unknown",
    publication_type_label: deliverableTypeShortLabel(r.publication_type ?? "unknown"),
    platform_label: getPlatformOptionLabel(platformKey),
    content_url: r.content_url ?? null,
    publication_date: r.publication_date ?? null,
    status: r.status ?? "draft",
    assignee_id: r.assignee_id ?? null,
    assignee_name: null,
    caption: r.caption ?? null,
    hashtags: r.hashtags ?? null,
    mentions: r.mentions ?? null,
    hashtag_count: num(r.hashtag_count),
    mention_count: num(r.mention_count),
    thumbnail_url: r.thumbnail_url ?? null,
    screenshot_url: r.screenshot_url ?? null,
    screenshot_captured_at: r.screenshot_captured_at ?? null,
    screenshot_source: r.screenshot_source ?? null,
    notes: r.notes ?? null,
    auto_detected: r.auto_detected ?? false,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? null,
    last_synced_at: r.last_synced_at ?? null,
    sync_status: r.sync_status ?? r.api_sync_status ?? null,
    sync_source: r.sync_source ?? r.detection_source ?? null,
    metrics_refresh_status: r.metrics_refresh_status ?? null,
    metrics_refresh_attempted_at: r.metrics_refresh_attempted_at ?? null,
    metrics_collection_source: r.metrics_collection_source ?? null,
    metrics_provider: r.metrics_provider ?? r.metrics_collection_source ?? null,
    metrics_confidence: num(r.metrics_confidence),
    stored_engagements: num(r.engagements),
    impressions,
    impressions_source,
    actual_impressions,
    forecast_impressions,
    forecast_impressions_formula:
      impressions_source === "forecast"
        ? computeImpressionsForecast({
            platform: platformKey,
            publication_type: r.publication_type,
            views,
            effectiveReach: reach,
          }).formula
        : null,
    reach,
    reach_source,
    actual_reach,
    forecast_reach,
    views,
    unique_views: num(r.unique_views),
    likes,
    comments,
    shares,
    saves,
    clicks,
    plays: num(r.plays),
    watch_time_seconds: num(r.watch_time_seconds),
    average_watch_time_seconds: num(r.average_watch_time_seconds),
    completion_rate: num(r.completion_rate),
    engagement_rate,
    engagement_rate_method,
    platform_follower_count: platformFollowerCount,
    view_rate: num(r.view_rate) ?? derived.view_rate,
    cpm: num(r.cpm) ?? derived.cpm,
    cpv: num(r.cpv) ?? derived.cpv,
    cpe: num(r.cpe) ?? derived.cpe,
    cpc: num(r.cpc) ?? derived.cpc,
    sentiment_score: num(r.sentiment_score),
    brand_safety_score: num(r.brand_safety_score),
    authenticity_score: num(r.authenticity_score),
    cost,
    currency: r.currency ?? "USD",
    total_engagements: num(r.engagements) ?? engagements,
  };
}

async function loadInfluencerMeta(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
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

async function loadApifyAuthorAvatarsFromSyncLogs(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
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

function buildSummary(publications: CampaignPublicationRow[]): CampaignPerformanceSummary {
  const total_reach = publications.reduce((s, p) => s + (p.reach ?? 0), 0);
  const total_actual_reach = publications.reduce(
    (s, p) => s + (p.reach_source === "actual" ? p.reach ?? 0 : 0),
    0
  );
  const total_forecast_reach = publications.reduce(
    (s, p) => s + (p.reach_source === "forecast" ? p.reach ?? 0 : 0),
    0
  );
  const total_manual_reach = publications.reduce(
    (s, p) => s + (p.reach_source === "manual" ? p.reach ?? 0 : 0),
    0
  );
  const total_impressions = publications.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const total_actual_impressions = publications.reduce(
    (s, p) => s + (p.impressions_source === "actual" ? p.impressions ?? 0 : 0),
    0
  );
  const total_forecast_impressions = publications.reduce(
    (s, p) => s + (p.impressions_source === "forecast" ? p.impressions ?? 0 : 0),
    0
  );
  const total_manual_impressions = publications.reduce(
    (s, p) => s + (p.impressions_source === "manual" ? p.impressions ?? 0 : 0),
    0
  );
  const total_views = publications.reduce((s, p) => s + (p.views ?? 0), 0);
  const total_engagements = publications.reduce((s, p) => s + p.total_engagements, 0);

  const erValues = publications
    .map((p) => p.engagement_rate)
    .filter((v): v is number => v != null);
  const cpmValues = publications.map((p) => p.cpm).filter((v): v is number => v != null);
  const cpvValues = publications.map((p) => p.cpv).filter((v): v is number => v != null);

  const creatorEngagements = new Map<string, number>();
  for (const p of publications) {
    const name = p.influencer_name ?? "Unknown";
    creatorEngagements.set(name, (creatorEngagements.get(name) ?? 0) + p.total_engagements);
  }
  let top_creator_name: string | null = null;
  let top_creator_engagements = 0;
  for (const [name, engagements] of creatorEngagements) {
    if (engagements > top_creator_engagements) {
      top_creator_name = name;
      top_creator_engagements = engagements;
    }
  }

  return {
    total_publications: publications.length,
    total_reach,
    total_actual_reach,
    total_forecast_reach,
    total_manual_reach,
    total_impressions,
    total_actual_impressions,
    total_forecast_impressions,
    total_manual_impressions,
    total_views,
    total_engagements,
    average_engagement_rate:
      erValues.length > 0 ? erValues.reduce((a, b) => a + b, 0) / erValues.length : null,
    average_cpm: cpmValues.length > 0 ? cpmValues.reduce((a, b) => a + b, 0) / cpmValues.length : null,
    average_cpv: cpvValues.length > 0 ? cpvValues.reduce((a, b) => a + b, 0) / cpvValues.length : null,
    top_creator_name,
    top_creator_engagements,
    currency: publications[0]?.currency ?? "USD",
  };
}

function buildCharts(publications: CampaignPublicationRow[]): CampaignPerformanceCharts {
  const byDate = new Map<string, { views: number; engagements: number; reach: number }>();
  const byPlatform = new Map<string, { count: number; engagements: number }>();
  const byType = new Map<string, number>();
  const byCreatorEng = new Map<string, { engagements: number; views: number }>();
  const byCreatorReach = new Map<string, number>();

  for (const p of publications) {
    const date = p.publication_date ?? p.created_at.slice(0, 10);
    const bucket = byDate.get(date) ?? { views: 0, engagements: 0, reach: 0 };
    bucket.views += p.views ?? 0;
    bucket.engagements += p.total_engagements;
    bucket.reach += p.reach ?? 0;
    byDate.set(date, bucket);

    const plat = byPlatform.get(p.platform) ?? { count: 0, engagements: 0 };
    plat.count += 1;
    plat.engagements += p.total_engagements;
    byPlatform.set(p.platform, plat);

    byType.set(p.publication_type, (byType.get(p.publication_type) ?? 0) + 1);

    const creator = p.influencer_name ?? "Unknown";
    const ce = byCreatorEng.get(creator) ?? { engagements: 0, views: 0 };
    ce.engagements += p.total_engagements;
    ce.views += p.views ?? 0;
    byCreatorEng.set(creator, ce);
    byCreatorReach.set(creator, (byCreatorReach.get(creator) ?? 0) + (p.reach ?? 0));
  }

  const engagementBuckets = [
    { bucket: "0", count: 0 },
    { bucket: "1–100", count: 0 },
    { bucket: "101–1K", count: 0 },
    { bucket: "1K–10K", count: 0 },
    { bucket: "10K+", count: 0 },
  ];
  for (const p of publications) {
    const e = p.total_engagements;
    if (e <= 0) engagementBuckets[0]!.count += 1;
    else if (e <= 100) engagementBuckets[1]!.count += 1;
    else if (e <= 1000) engagementBuckets[2]!.count += 1;
    else if (e <= 10000) engagementBuckets[3]!.count += 1;
    else engagementBuckets[4]!.count += 1;
  }

  return {
    performance_over_time: [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    platform_split: [...byPlatform.entries()].map(([platform, v]) => ({
      platform,
      label: getPlatformOptionLabel(platform),
      count: v.count,
      engagements: v.engagements,
    })),
    content_type_split: [...byType.entries()].map(([type, count]) => ({
      type,
      label: deliverableTypeShortLabel(type),
      count,
    })),
    top_creators_by_engagement: [...byCreatorEng.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.engagements - a.engagements)
      .slice(0, 8),
    reach_by_creator: [...byCreatorReach.entries()]
      .map(([name, reach]) => ({ name, reach }))
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 8),
    views_by_publication: publications
      .map((p) => ({
        id: p.id,
        label: `${p.influencer_name ?? "Creator"} · ${p.publication_type_label}`,
        views: p.views ?? 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    engagement_distribution: engagementBuckets,
  };
}

function buildSyncHealth(publications: CampaignPublicationRow[]): CampaignMetricsSyncHealth {
  const health: CampaignMetricsSyncHealth = {
    synced: 0,
    partial: 0,
    failed: 0,
    manual_required: 0,
    queued: 0,
    collecting: 0,
    total: publications.length,
  };

  for (const row of publications) {
    const status = row.metrics_refresh_status ?? "pending";
    if (status === "completed") health.synced += 1;
    else if (status === "partial") health.partial += 1;
    else if (status === "failed") health.failed += 1;
    else if (status === "manual_required") health.manual_required += 1;
    else if (status === "queued") health.queued += 1;
    else if (status === "collecting") health.collecting += 1;
  }

  return health;
}

function emptySyncHealth(): CampaignMetricsSyncHealth {
  return {
    synced: 0,
    partial: 0,
    failed: 0,
    manual_required: 0,
    queued: 0,
    collecting: 0,
    total: 0,
  };
}

export async function getCampaignPerformanceBundle(
  campaignHeaderId: string,
  supabaseClient?: SupabaseClient
): Promise<CampaignPerformanceBundle> {
  traceCampaignRoute("performance:bundle:start", { campaignHeaderId });
  const supabase = supabaseClient ?? (await createSupabaseServerClient());
  const schema = await getCampaignPublicationsSchema(supabase);
  traceCampaignRoute("performance:schema:loaded", {
    campaignHeaderId,
    compatible: schema.partition.isCompatible,
    columnCount: schema.columns.size,
    warnings: schema.warnings.length,
  });

  if (!schema.partition.isCompatible) {
    const message = `Missing required columns: ${schema.partition.missingRequired.join(", ")}. Apply migration ${CAMPAIGN_PUBLICATIONS_EXPECTED_MIGRATION}.`;
    console.warn("[performance] schema incompatible", { message, warnings: schema.warnings });
    return {
      publications: [],
      summary: emptySummary(),
      charts: emptyCharts(),
      sync_health: emptySyncHealth(),
      load_error: message,
      schema_warnings: schema.warnings,
    };
  }

  const { data, error } = await supabase
    .from("campaign_publications")
    .select(schema.selectList)
    .eq("campaign_header_id", campaignHeaderId)
    .order("publication_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    traceCampaignRouteError("performance:query:failed", error, { campaignHeaderId });
    console.warn("[performance] query failed", { campaignHeaderId, message: error.message });
    return {
      publications: [],
      summary: emptySummary(),
      charts: emptyCharts(),
      sync_health: emptySyncHealth(),
      load_error: error.message,
      schema_warnings: schema.warnings,
    };
  }

  const rows = (data ?? []) as PublicationRecord[];
  const influencerIds = [
    ...new Set(rows.map((r) => r.influencer_id).filter((id): id is string => id != null)),
  ];
  const influencerMeta = await loadInfluencerMeta(supabase, influencerIds);
  const apifyAuthorAvatars = await loadApifyAuthorAvatarsFromSyncLogs(
    supabase,
    rows.map((r) => r.id).filter((id): id is string => id != null)
  );
  const publicationsRaw = rows.map((r) =>
    mapPublicationRecord(r, influencerMeta.names, influencerMeta.avatars, apifyAuthorAvatars)
  );
  const publications = await Promise.all(
    publicationsRaw.map(async (row) => {
      const [thumbnail_url, screenshot_url] = await Promise.all([
        createPublicationMediaSignedUrl(supabase, row.thumbnail_url),
        createPublicationMediaSignedUrl(supabase, row.screenshot_url),
      ]);
      return {
        ...row,
        thumbnail_url: resolvePublicationMediaDisplayUrl(thumbnail_url, row.thumbnail_url),
        screenshot_url: resolvePublicationMediaDisplayUrl(screenshot_url, row.screenshot_url),
      };
    })
  );

  traceCampaignRoute("performance:bundle:ok", {
    campaignHeaderId,
    publicationCount: publications.length,
  });

  return {
    publications,
    summary: buildSummary(publications),
    charts: buildCharts(publications),
    sync_health: buildSyncHealth(publications),
    load_error: null,
    schema_warnings: schema.warnings,
  };
}

/** @deprecated Use getCampaignPerformanceBundle */
export async function getCampaignPublications(campaignHeaderId: string) {
  const bundle = await getCampaignPerformanceBundle(campaignHeaderId);
  return { publications: bundle.publications, load_error: bundle.load_error };
}

export { formatCompactCount };
