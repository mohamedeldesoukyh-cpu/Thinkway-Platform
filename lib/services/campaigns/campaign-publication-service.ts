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
  averageEngagementRateAgainstAgreed,
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
  resolvePublicationValueScope,
} from "@/lib/performance/publication-value-scope";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const agreed_publications = publications.filter(
    (p) => resolvePublicationValueScope(p) === "agreed"
  ).length;
  const added_value_publications = publications.filter(
    (p) => resolvePublicationValueScope(p) === "added_value"
  ).length;

  // Campaign Avg ER: sum ER across all posts (agreed + added value), divide by agreed count only.
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
    agreed_publications,
    added_value_publications,
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
    average_engagement_rate: averageEngagementRateAgainstAgreed(
      publications.map((p) => p.engagement_rate),
      agreed_publications
    ),
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
  const publicationsSigned = await Promise.all(
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
  const agreedPlatformIndex = await loadAssignmentAgreedPlatformIndex(
    supabase,
    campaignHeaderId
  );
  const publications = applyPublicationValueScopes(
    publicationsSigned,
    agreedPlatformIndex
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
