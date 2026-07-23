import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingTableError } from "@/lib/platform/schema-validation";

import type {
  CreatorPerformanceBaseline,
  ForecastDataSource,
  NormalizedHistoricalMetricPoint,
} from "../types";

type BaselineRow = {
  platform: string;
  content_type: string;
  sample_count: number;
  avg_reach: number | null;
  avg_views: number | null;
  avg_impressions: number | null;
  avg_engagements: number | null;
  avg_engagement_rate: number | null;
  confidence: number | null;
  data_source: string;
  computed_at: string;
  baseline_version: string;
};

type MetricsHistoryRow = {
  followers: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  posting_frequency_per_week: number | null;
  captured_at: string;
  source: string;
};

type CampaignPublicationRow = {
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
};

export function mapBaselineRow(row: BaselineRow): CreatorPerformanceBaseline {
  return {
    platform: row.platform,
    contentType: row.content_type,
    averageReach: row.avg_reach != null ? Number(row.avg_reach) : null,
    averageViews: row.avg_views != null ? Number(row.avg_views) : null,
    averageImpressions: row.avg_impressions != null ? Number(row.avg_impressions) : null,
    averageEngagements: row.avg_engagements != null ? Number(row.avg_engagements) : null,
    averageEngagementRate:
      row.avg_engagement_rate != null ? Number(row.avg_engagement_rate) : null,
    sampleCount: row.sample_count,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    dataSource: (row.data_source as ForecastDataSource) ?? "stored_baseline",
    lastCalculated: row.computed_at,
    baselineVersion: row.baseline_version,
  };
}

export async function loadStoredBaselines(
  supabase: SupabaseClient,
  input: { influencerId?: string | null; discoveredProfileId?: string | null }
): Promise<CreatorPerformanceBaseline[]> {
  let query = supabase
    .from("creator_content_performance_baselines")
    .select(
      "platform, content_type, sample_count, avg_reach, avg_views, avg_impressions, avg_engagements, avg_engagement_rate, confidence, data_source, computed_at, baseline_version"
    );

  if (input.influencerId) {
    query = query.eq("influencer_id", input.influencerId);
  } else if (input.discoveredProfileId) {
    query = query.eq("discovered_profile_id", input.discoveredProfileId);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error.message, error.code)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapBaselineRow(row as BaselineRow));
}

export async function loadInternalMetricsHistoryPoints(
  supabase: SupabaseClient,
  influencerId: string
): Promise<{
  followers: NormalizedHistoricalMetricPoint[];
  engagementRate: NormalizedHistoricalMetricPoint[];
  avgViews: NormalizedHistoricalMetricPoint[];
  postingFrequency: NormalizedHistoricalMetricPoint[];
  source: ForecastDataSource;
}> {
  const { data, error } = await supabase
    .from("influencer_metrics_history")
    .select(
      "followers, engagement_rate, avg_views, posting_frequency_per_week, captured_at, source"
    )
    .eq("influencer_id", influencerId)
    .order("captured_at", { ascending: true })
    .limit(90);

  if (error) {
    if (isMissingTableError(error.message, error.code)) {
      return {
        followers: [],
        engagementRate: [],
        avgViews: [],
        postingFrequency: [],
        source: "influencer_metrics_history",
      };
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MetricsHistoryRow[];
  return {
    followers: rows.map((row) => ({
      capturedAt: row.captured_at,
      value: Number(row.followers ?? 0),
    })),
    engagementRate: rows
      .filter((row) => row.engagement_rate != null)
      .map((row) => ({
        capturedAt: row.captured_at,
        value: Number(row.engagement_rate),
      })),
    avgViews: rows
      .filter((row) => row.avg_views != null)
      .map((row) => ({
        capturedAt: row.captured_at,
        value: Number(row.avg_views),
      })),
    postingFrequency: rows
      .filter((row) => row.posting_frequency_per_week != null)
      .map((row) => ({
        capturedAt: row.captured_at,
        value: Number(row.posting_frequency_per_week),
      })),
    source: "influencer_metrics_history",
  };
}

export async function loadDiscoveryMetricsHistoryPoints(
  supabase: SupabaseClient,
  discoveredProfileId: string
): Promise<{
  followers: NormalizedHistoricalMetricPoint[];
  engagementRate: NormalizedHistoricalMetricPoint[];
  avgViews: NormalizedHistoricalMetricPoint[];
  postingFrequency: NormalizedHistoricalMetricPoint[];
  source: ForecastDataSource;
}> {
  const { data, error } = await supabase
    .from("profile_metrics")
    .select(
      "followers, engagement_rate, avg_views, posting_frequency_per_week, captured_at"
    )
    .eq("profile_id", discoveredProfileId)
    .order("captured_at", { ascending: true })
    .limit(90);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return {
    followers: rows.map((row) => ({
      capturedAt: row.captured_at as string,
      value: Number(row.followers ?? 0),
    })),
    engagementRate: rows
      .filter((row) => row.engagement_rate != null)
      .map((row) => ({
        capturedAt: row.captured_at as string,
        value: Number(row.engagement_rate),
      })),
    avgViews: rows
      .filter((row) => row.avg_views != null)
      .map((row) => ({
        capturedAt: row.captured_at as string,
        value: Number(row.avg_views),
      })),
    postingFrequency: rows
      .filter((row) => row.posting_frequency_per_week != null)
      .map((row) => ({
        capturedAt: row.captured_at as string,
        value: Number(row.posting_frequency_per_week),
      })),
    source: "profile_metrics",
  };
}

export async function loadCampaignPublicationsForInfluencer(
  supabase: SupabaseClient,
  influencerId: string
): Promise<CampaignPublicationRow[]> {
  const { data, error } = await supabase
    .from("campaign_publications")
    .select(
      "platform, publication_type, reach, forecast_reach, actual_reach, impressions, views, engagements, engagement_rate, metrics_refresh_status"
    )
    .eq("influencer_id", influencerId)
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignPublicationRow[];
}

export async function loadProfilePostsForDiscovery(
  supabase: SupabaseClient,
  discoveredProfileId: string
): Promise<
  Array<{
    views: number | null;
    likes: number | null;
    comments: number | null;
    caption: string | null;
    posted_at: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("profile_posts")
    .select("views, likes, comments, caption, posted_at")
    .eq("profile_id", discoveredProfileId)
    .order("posted_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingTableError(error.message, error.code)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}
