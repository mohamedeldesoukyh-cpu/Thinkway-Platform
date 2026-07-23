import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { resolvePrimaryPlatformAccount } from "@/features/campaign-studio/services/creator-platform-utils";

import {
  buildProfileConfidence,
  buildProfileDiagnostics,
  computeTrend,
  daysSince,
  resolveReadiness,
} from "./diagnostics";
import {
  aggregateCampaignPublications,
  computeBaselinesFromPublications,
  mergeBaselines,
  normalizeEnrichmentPublications,
} from "./sources/normalize-sources";
import type {
  CreatorForecastProfile,
  ForecastDataSource,
  ForecastProfileSourceContext,
  NormalizedPublicationMetric,
} from "./types";
import {
  FORECAST_BASELINE_VERSION,
  FORECAST_HISTORICAL_DATA_VERSION,
  FORECAST_PROFILE_VERSION,
} from "./types";

function parseUnifiedIds(unifiedId: string | null | undefined): {
  influencerId: string | null;
  discoveredProfileId: string | null;
} {
  if (!unifiedId) return { influencerId: null, discoveredProfileId: null };
  const [kind, id] = unifiedId.split(":");
  if (!id) return { influencerId: null, discoveredProfileId: null };
  if (kind === "inf") return { influencerId: id, discoveredProfileId: null };
  if (kind === "dis") return { influencerId: null, discoveredProfileId: id };
  return { influencerId: null, discoveredProfileId: null };
}

function primaryBaselineSource(
  baselines: CreatorForecastProfile["forecastBaselines"]
): ForecastDataSource | null {
  if (!baselines.length) return null;
  const sorted = [...baselines].sort((a, b) => b.sampleCount - a.sampleCount);
  return sorted[0]?.dataSource ?? null;
}

function campaignRowsToPublicationMetrics(
  rows: NonNullable<ForecastProfileSourceContext["campaignPublications"]>
): NormalizedPublicationMetric[] {
  return rows.map((row) => {
    const platform = canonicalPlatformKey(row.platform ?? "") || row.platform || "unknown";
    return {
      platform,
      contentType: (row.publication_type ?? "unknown").toLowerCase(),
      views: row.views,
      reach: row.reach ?? row.actual_reach,
      impressions: row.impressions,
      engagements: row.engagements,
      engagementRate: row.engagement_rate,
      postedAt: null,
      source: "campaign_publications" as ForecastDataSource,
    };
  });
}

/**
 * Build a normalized Creator Forecast Profile from any available source context.
 * The Forecast Engine never reads raw DB tables — only hydrated output from this builder.
 */
export function buildCreatorForecastProfile(
  context: ForecastProfileSourceContext
): CreatorForecastProfile {
  const now = new Date().toISOString();
  const sourceMapping: CreatorForecastProfile["diagnostics"]["sourceMapping"] = [];
  const unified = context.unified;
  const manual = context.manualSnapshot;

  const unifiedId = unified?.unified_id ?? null;
  const { influencerId, discoveredProfileId } = parseUnifiedIds(unifiedId);
  const account = unified
    ? resolvePrimaryPlatformAccount(unified, context.preferredPlatforms)
    : undefined;
  const primaryPlatform = account
    ? canonicalPlatformKey(account.platform)
    : manual?.primaryPlatform
      ? canonicalPlatformKey(manual.primaryPlatform)
      : context.preferredPlatforms?.[0]
        ? canonicalPlatformKey(context.preferredPlatforms[0])
        : null;

  const enrichmentPublications = unified
    ? normalizeEnrichmentPublications(unified, context.preferredPlatforms)
    : [];
  if (enrichmentPublications.length) {
    sourceMapping.push({
      section: "publicationPerformance",
      source: "enrichment_publications",
      detail: `${enrichmentPublications.length} recent publications from influencer_platform_accounts.recent_publications`,
    });
  }

  const campaignRows = context.campaignPublications ?? [];
  const campaignPerformance = aggregateCampaignPublications(campaignRows);
  if (campaignRows.length) {
    sourceMapping.push({
      section: "campaignPerformance",
      source: "campaign_publications",
      detail: `${campaignRows.length} campaign publication rows aggregated`,
    });
  }

  const metricsHistory = context.metricsHistory;
  if (metricsHistory) {
    sourceMapping.push({
      section: "historicalPerformance",
      source: metricsHistory.source,
      detail: `${metricsHistory.followers.length} metrics history snapshots`,
    });
  }

  const storedBaselines = context.baselines ?? [];
  if (storedBaselines.length) {
    sourceMapping.push({
      section: "forecastBaselines",
      source: "stored_baseline",
      detail: `${storedBaselines.length} rows from creator_content_performance_baselines`,
    });
  }

  if (manual && !unified) {
    sourceMapping.push({
      section: "identity",
      source: "manual",
      detail: "Roster export snapshot (followers, ER, platform) — no unified enrichment row loaded",
    });
  }

  const computedBaselines = computeBaselinesFromPublications([
    ...enrichmentPublications,
    ...campaignRowsToPublicationMetrics(campaignRows),
  ]);

  const forecastBaselines = mergeBaselines(storedBaselines, computedBaselines);

  const followerSeries = metricsHistory?.followers ?? [];
  const engagementRateSeries = metricsHistory?.engagementRate ?? [];
  const historicalPerformance = {
    followerSeries,
    engagementRateSeries,
    avgViewsSeries: metricsHistory?.avgViews ?? [],
    postingFrequencySeries: metricsHistory?.postingFrequency ?? [],
    followerGrowthTrend: computeTrend(followerSeries),
    engagementTrend: computeTrend(engagementRateSeries),
    dataFreshnessDays: unified?.last_enriched_at
      ? daysSince(unified.last_enriched_at)
      : null,
    primarySource: metricsHistory?.source ?? ("platform_benchmark" as ForecastDataSource),
  };

  const followers =
    account?.follower_count ??
    unified?.metrics?.followers?.value ??
    manual?.followers ??
    null;
  const engagementRate =
    account?.engagement_rate ??
    unified?.metrics?.engagement_rate?.value ??
    manual?.engagementRate ??
    null;

  const readiness = resolveReadiness({
    historicalSampleCount:
      enrichmentPublications.length + followerSeries.length + campaignRows.length,
    baselineSampleCount: forecastBaselines.reduce((sum, b) => sum + b.sampleCount, 0),
    followers,
  });

  const freshness = {
    lastEnrichedAt: unified?.last_enriched_at ?? null,
    metricsLastSyncedAt: unified?.last_enriched_at ?? null,
    dataFreshnessDays: historicalPerformance.dataFreshnessDays,
    isVerified: Boolean(account?.is_verified ?? unified?.is_platform_verified),
    dnaCompleteness: unified?.dna_completeness ?? null,
  };

  const confidence = buildProfileConfidence({
    readiness,
    historicalSampleCount:
      enrichmentPublications.length + followerSeries.length + campaignRows.length,
    baselineSampleCount: forecastBaselines.reduce((sum, b) => sum + b.sampleCount, 0),
    dataFreshnessDays: freshness.dataFreshnessDays,
    isVerified: freshness.isVerified,
  });

  const profileWithoutDiagnostics: Omit<CreatorForecastProfile, "diagnostics"> = {
    versioning: {
      profileVersion: FORECAST_PROFILE_VERSION,
      baselineVersion: storedBaselines[0]?.baselineVersion ?? FORECAST_BASELINE_VERSION,
      historicalDataVersion: FORECAST_HISTORICAL_DATA_VERSION,
      generatedAt: now,
      lastRefreshed: now,
    },
    identity: {
      creatorKey:
        context.creatorKeyOverride ??
        manual?.creatorKey ??
        unifiedId ??
        influencerId ??
        discoveredProfileId ??
        "unknown",
      unifiedId,
      influencerId,
      discoveredProfileId,
      displayName: unified?.display_name ?? manual?.displayName ?? null,
      handle: account?.handle ?? manual?.handle ?? null,
    },
    primaryPlatform,
    platforms: unified?.platforms?.map((p) => canonicalPlatformKey(p.platform)) ?? (
      primaryPlatform ? [primaryPlatform] : []
    ),
    audience: {
      countryCode: unified?.country_code ?? account?.audience_country ?? null,
      countryCodes: unified?.country_codes ?? [],
      languageCodes: unified?.language_codes ?? [],
      categories: [
        ...(unified?.categories ?? []),
        ...(unified?.browse_category_tags ?? []),
        ...(unified?.ai_category ? [unified.ai_category] : []),
        ...(manual?.categories ?? []),
      ],
      niche: unified?.ai_niche ?? null,
      audienceInterests: unified?.audience_interests ?? [],
    },
    followers,
    engagement: {
      engagementRate,
      avgViews: account?.avg_views ?? unified?.metrics?.avg_views?.value ?? null,
      avgLikes: account?.avg_likes ?? unified?.metrics?.avg_likes?.value ?? null,
      avgComments: account?.avg_comments ?? unified?.metrics?.avg_comments?.value ?? null,
    },
    historicalPerformance,
    publicationPerformance: {
      recentPublications: enrichmentPublications,
      totalSamples: enrichmentPublications.length,
    },
    campaignPerformance,
    forecastBaselines,
    freshness,
    confidence,
    readiness,
    ...(context.deliverables?.length
      ? { forecastContext: { deliverables: context.deliverables } }
      : {}),
  };

  const diagnostics = buildProfileDiagnostics({
    ...profileWithoutDiagnostics,
    primaryBaselineSource: primaryBaselineSource(forecastBaselines),
    sourceMapping,
  });

  return {
    ...profileWithoutDiagnostics,
    diagnostics,
  };
}

export async function loadAndBuildCreatorForecastProfile(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  input: {
    unifiedId: string;
    unified?: UnifiedCreatorResult;
    preferredPlatforms?: string[];
    creatorKeyOverride?: string;
    deliverables?: ForecastProfileSourceContext["deliverables"];
  }
): Promise<CreatorForecastProfile> {
  const {
    loadCampaignPublicationsForInfluencer,
    loadDiscoveryMetricsHistoryPoints,
    loadInternalMetricsHistoryPoints,
    loadStoredBaselines,
  } = await import("./sources/load-db-sources");

  const { influencerId, discoveredProfileId } = parseUnifiedIds(input.unifiedId);

  const [baselines, metricsHistory, campaignPublications] = await Promise.all([
    loadStoredBaselines(supabase, { influencerId, discoveredProfileId }),
    influencerId
      ? loadInternalMetricsHistoryPoints(supabase, influencerId)
      : discoveredProfileId
        ? loadDiscoveryMetricsHistoryPoints(supabase, discoveredProfileId)
        : Promise.resolve({
            followers: [],
            engagementRate: [],
            avgViews: [],
            postingFrequency: [],
            source: "profile_metrics" as ForecastDataSource,
          }),
    influencerId
      ? loadCampaignPublicationsForInfluencer(supabase, influencerId)
      : Promise.resolve([]),
  ]);

  return buildCreatorForecastProfile({
    unified: input.unified,
    baselines,
    metricsHistory,
    campaignPublications,
    preferredPlatforms: input.preferredPlatforms,
    creatorKeyOverride: input.creatorKeyOverride,
    deliverables: input.deliverables,
  });
}
