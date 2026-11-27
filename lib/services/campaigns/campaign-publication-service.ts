import { tryCreateServiceRoleClient } from '@/lib/supabase/service-role-client';
import { buildPerformanceSummary, buildPerformanceCharts } from "@/lib/performance/campaign-performance-aggregates";
import { attachReportVideoCounters } from "@/lib/performance/report/report-video-counters";
import type { SupabaseClient } from "@supabase/supabase-js";

import { deliverableTypeShortLabel, getPlatformOptionLabel, canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { CAMPAIGN_PUBLICATIONS_EXPECTED_MIGRATION } from "@/lib/campaigns/campaign-publications-schema";
import { getCampaignPublicationsSchema } from "@/lib/campaigns/campaign-publications-schema-runtime";
import type {
  CampaignPerformanceBundle,
  CampaignPerformanceCharts,
  CampaignPerformanceSummary,
  CampaignPublicationRow,
} from "@/lib/domains/campaign/types";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { authorAvatarFromSyncLogSummary } from "@/lib/performance/apify-author-avatar";
import { traceCampaignRoute, traceCampaignRouteError } from "@/lib/performance/campaign-route-trace";
import {
  isAvatarUrlAllowedForPlatform,
  resolvePublicationCreatorAvatar,
  resolvePublicationEffectivePlatform,
} from "@/lib/performance/creator-avatar";
import {
  computeEngagementSnapshot,
} from "@/lib/performance/engagement-rate-engine";
import { computeImpressionsForecast } from "@/lib/performance/impressions-forecast-engine";
import { sanitizeMetricValue } from "@/lib/performance/metrics-collector/merge-metrics";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import {
  createPublicationMediaSignedUrl,
  resolvePublicationMediaDisplayUrl,
} from "@/lib/performance/screenshot-capture/storage";
import {
  deriveCalculatedMetrics,
  formatCompactCount,
  type PerformanceMetricInput,
} from "@/lib/campaigns/performance-calculations";
import { loadAssignmentAgreedPlatformIndex } from "@/lib/performance/load-assignment-agreed-platforms";
import {
  applyPublicationValueScopes,
} from "@/lib/performance/publication-value-scope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { attachStoryPublicationPreviews } from "@/lib/performance/story-publication-previews";

import {
  fetchCampaignPublicationRows,
  fetchInfluencerMetaForPublications,
  fetchApifyAuthorAvatarsFromSyncLogs,
  type PublicationRecord,
} from "./repositories/publication-repository";

export { formatCompactCount };

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
    agreed_publications: 0,
    added_value_publications: 0,
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
  const engagement_rate = storedEr ?? engagementSnapshot.engagement_rate;
  const engagement_rate_method = storedMethod ?? engagementSnapshot.engagement_rate_method;

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
    influencer_handle:
      platformAvatarMeta?.handle?.trim() ||
      genericAvatarMeta?.handle?.trim() ||
      null,
    influencer_profile_url:
      platformAvatarMeta?.profileUrl ?? genericAvatarMeta?.profileUrl ?? null,
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
    value_scope: "agreed",
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

  const { data, error } = await fetchCampaignPublicationRows(
    supabase,
    campaignHeaderId,
    schema.selectList
  );

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
  const influencerMeta = await fetchInfluencerMetaForPublications(supabase, influencerIds);
  const apifyAuthorAvatars = await fetchApifyAuthorAvatarsFromSyncLogs(
    supabase,
    rows.map((r) => r.id).filter((id): id is string => id != null)
  );
  const publicationsRaw = rows.map((r) =>
    mapPublicationRecord(r, influencerMeta.names, influencerMeta.avatars, apifyAuthorAvatars)
  );
  // Rows above have already passed campaign RLS. Sign only their stored media
  // with the storage service client; user storage policies may deny signing.
  const mediaClient = tryCreateServiceRoleClient().client ?? supabase;
  const publicationsSigned = await Promise.all(
    publicationsRaw.map(async (row) => {
      const [thumbnail_url, screenshot_url] = await Promise.all([
        createPublicationMediaSignedUrl(mediaClient, row.thumbnail_url),
        createPublicationMediaSignedUrl(mediaClient, row.screenshot_url),
      ]);
      return {
        ...row,
        thumbnail_url: resolvePublicationMediaDisplayUrl(thumbnail_url, row.thumbnail_url),
        screenshot_url: resolvePublicationMediaDisplayUrl(screenshot_url, row.screenshot_url),
      };
    })
  );
  const agreedPlatformIndex = await loadAssignmentAgreedPlatformIndex(
    supabase,
    campaignHeaderId
  );
  const scopedPublications = applyPublicationValueScopes(
    await attachStoryPublicationPreviews(supabase, campaignHeaderId, publicationsSigned),
    agreedPlatformIndex
  );

  const publications = await attachReportVideoCounters(supabase, scopedPublications);
  traceCampaignRoute("performance:bundle:ok", {
    campaignHeaderId,
    publicationCount: publications.length,
  });

  return {
    publications,
    summary: buildPerformanceSummary(publications),
    charts: buildPerformanceCharts(publications),
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



