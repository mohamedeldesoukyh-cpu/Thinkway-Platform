import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { resolvePrimaryPlatformAccount } from "@/features/campaign-studio/services/creator-platform-utils";

import type {
  CampaignPerformanceAggregate,
  CampaignPerformanceContentSummary,
  CreatorPerformanceBaseline,
  ForecastDataSource,
  NormalizedPublicationMetric,
} from "../types";

function inferContentType(input: {
  isVideo?: boolean;
  caption?: string | null;
  platform?: string | null;
}): string {
  if (input.isVideo) {
    const platform = canonicalPlatformKey(input.platform ?? "");
    if (platform === "tiktok") return "tiktok_video";
    if (platform === "youtube") return "youtube_video";
    return "instagram_reel";
  }
  const caption = (input.caption ?? "").toLowerCase();
  if (caption.includes("reel")) return "instagram_reel";
  if (caption.includes("story")) return "instagram_story";
  if (caption.includes("tiktok")) return "tiktok_video";
  const platform = canonicalPlatformKey(input.platform ?? "");
  if (platform === "tiktok") return "tiktok_video";
  if (platform === "youtube") return "youtube_video";
  return "instagram_post";
}

export function normalizeEnrichmentPublications(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): NormalizedPublicationMetric[] {
  const account = resolvePrimaryPlatformAccount(creator, preferredPlatforms);
  const platform = account?.platform ?? "instagram";
  const publications = [
    ...(account?.recent_publications ?? []),
    ...(creator.recent_publications ?? []),
  ].slice(0, 20);

  return publications.map((publication) => {
    const contentType = inferContentType({
      isVideo: publication.isVideo,
      caption: publication.caption,
      platform,
    });
    const engagements =
      (publication.likes ?? 0) + (publication.comments ?? 0) > 0
        ? (publication.likes ?? 0) + (publication.comments ?? 0)
        : null;
    return {
      platform: canonicalPlatformKey(platform) || platform,
      contentType,
      views: publication.views,
      reach: publication.views != null ? Math.round(publication.views * 0.92) : null,
      impressions: null,
      engagements,
      engagementRate: null,
      postedAt: publication.posted_at,
      source: "enrichment_publications" as ForecastDataSource,
    };
  });
}

export function aggregateCampaignPublications(
  rows: Array<{
    platform: string | null;
    publication_type: string | null;
    reach: number | null;
    forecast_reach: number | null;
    actual_reach: number | null;
    impressions: number | null;
    views: number | null;
    engagements: number | null;
    engagement_rate: number | null;
    metrics_refresh_status: string | null;
  }>
): CampaignPerformanceAggregate {
  type Bucket = {
    platform: string;
    contentType: string;
    publicationCount: number;
    reachSum: number;
    viewsSum: number;
    impressionsSum: number;
    engagementsSum: number;
    erSum: number;
    erCount: number;
    forecastSum: number;
    actualSum: number;
    forecastCount: number;
  };

  const byKey = new Map<string, Bucket>();

  let completed = 0;
  let forecastVsActualTotal = 0;
  let forecastVsActualCount = 0;

  for (const row of rows) {
    const platform = canonicalPlatformKey(row.platform ?? "") || row.platform || "unknown";
    const contentType = (row.publication_type ?? "unknown").toLowerCase();
    const key = `${platform}:${contentType}`;
    const bucket: Bucket =
      byKey.get(key) ?? {
        platform,
        contentType,
        publicationCount: 0,
        reachSum: 0,
        viewsSum: 0,
        impressionsSum: 0,
        engagementsSum: 0,
        erSum: 0,
        erCount: 0,
        forecastSum: 0,
        actualSum: 0,
        forecastCount: 0,
      };

    bucket.publicationCount += 1;
    if (row.metrics_refresh_status === "completed") completed += 1;

    if (row.reach != null) bucket.reachSum += row.reach;
    if (row.views != null) bucket.viewsSum += row.views;
    if (row.impressions != null) bucket.impressionsSum += row.impressions;
    if (row.engagements != null) bucket.engagementsSum += row.engagements;
    if (row.engagement_rate != null) {
      bucket.erSum += row.engagement_rate;
      bucket.erCount += 1;
    }

    const forecast = row.forecast_reach ?? row.reach;
    const actual = row.actual_reach ?? row.reach;
    if (forecast != null && actual != null && forecast > 0) {
      bucket.forecastSum += forecast;
      bucket.actualSum += actual;
      bucket.forecastCount += 1;
      forecastVsActualTotal += actual / forecast;
      forecastVsActualCount += 1;
    }

    byKey.set(key, bucket);
  }

  const contentSummaries: CampaignPerformanceContentSummary[] = [...byKey.values()].map(
    (bucket) => {
      const count = bucket.publicationCount;
      return {
        platform: bucket.platform,
        contentType: bucket.contentType,
        publicationCount: count,
        averageReach: count > 0 ? Math.round(bucket.reachSum / count) : null,
        averageViews: count > 0 ? Math.round(bucket.viewsSum / count) : null,
        averageImpressions: count > 0 ? Math.round(bucket.impressionsSum / count) : null,
        averageEngagements: count > 0 ? Math.round(bucket.engagementsSum / count) : null,
        averageEngagementRate:
          bucket.erCount > 0 ? Number((bucket.erSum / bucket.erCount).toFixed(2)) : null,
        forecastVsActualRatio:
          bucket.forecastCount > 0
            ? Number((bucket.actualSum / Math.max(bucket.forecastSum, 1)).toFixed(3))
            : null,
        completionRate: rows.length > 0 ? completed / rows.length : null,
        dataSource: "campaign_publications",
      };
    }
  );

  return {
    totalPublications: rows.length,
    completedPublications: completed,
    completionRate: rows.length > 0 ? completed / rows.length : null,
    forecastVsActualAvg:
      forecastVsActualCount > 0
        ? Number((forecastVsActualTotal / forecastVsActualCount).toFixed(3))
        : null,
    contentSummaries,
    dataSource: "campaign_publications",
  };
}

export function computeBaselinesFromPublications(
  publications: NormalizedPublicationMetric[],
  source: ForecastDataSource = "computed_baseline"
): CreatorPerformanceBaseline[] {
  const byKey = new Map<
    string,
    CreatorPerformanceBaseline & {
      reachSum: number;
      viewsSum: number;
      impressionsSum: number;
      engagementsSum: number;
      erSum: number;
      erCount: number;
    }
  >();

  for (const publication of publications) {
    const key = `${publication.platform}:${publication.contentType}`;
    const bucket =
      byKey.get(key) ??
      {
        platform: publication.platform,
        contentType: publication.contentType,
        averageReach: null,
        averageViews: null,
        averageImpressions: null,
        averageEngagements: null,
        averageEngagementRate: null,
        sampleCount: 0,
        confidence: null,
        dataSource: source,
        lastCalculated: new Date().toISOString(),
        baselineVersion: "baseline_v1",
        reachSum: 0,
        viewsSum: 0,
        impressionsSum: 0,
        engagementsSum: 0,
        erSum: 0,
        erCount: 0,
      };

    bucket.sampleCount += 1;
    if (publication.reach != null) bucket.reachSum += publication.reach;
    if (publication.views != null) bucket.viewsSum += publication.views;
    if (publication.impressions != null) bucket.impressionsSum += publication.impressions;
    if (publication.engagements != null) bucket.engagementsSum += publication.engagements;
    if (publication.engagementRate != null) {
      bucket.erSum += publication.engagementRate;
      bucket.erCount += 1;
    }
    byKey.set(key, bucket);
  }

  return [...byKey.values()].map((bucket) => {
    const count = bucket.sampleCount;
    const confidence = Math.min(100, 40 + count * 3);
    return {
      platform: bucket.platform,
      contentType: bucket.contentType,
      averageReach: count > 0 ? Math.round(bucket.reachSum / count) : null,
      averageViews: count > 0 ? Math.round(bucket.viewsSum / count) : null,
      averageImpressions: count > 0 ? Math.round(bucket.impressionsSum / count) : null,
      averageEngagements: count > 0 ? Math.round(bucket.engagementsSum / count) : null,
      averageEngagementRate:
        bucket.erCount > 0 ? Number((bucket.erSum / bucket.erCount).toFixed(2)) : null,
      sampleCount: count,
      confidence,
      dataSource: bucket.dataSource,
      lastCalculated: bucket.lastCalculated,
      baselineVersion: bucket.baselineVersion,
    };
  });
}

export function mergeBaselines(
  stored: CreatorPerformanceBaseline[],
  computed: CreatorPerformanceBaseline[]
): CreatorPerformanceBaseline[] {
  const byKey = new Map<string, CreatorPerformanceBaseline>();
  for (const baseline of computed) {
    byKey.set(`${baseline.platform}:${baseline.contentType}`, baseline);
  }
  for (const baseline of stored) {
    byKey.set(`${baseline.platform}:${baseline.contentType}`, baseline);
  }
  return [...byKey.values()];
}
