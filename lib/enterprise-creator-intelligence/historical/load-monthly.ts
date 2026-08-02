import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveGrowthTrend } from "@/lib/enterprise-creator-intelligence/historical/compute";
import type {
  CreatorHistoricalAiHints,
  CreatorHistoricalMonthlySeries,
  CreatorMonthlyMetrics,
} from "@/lib/enterprise-creator-intelligence/historical/types";
import { isMissingTableError } from "@/lib/platform/schema-validation";

function mapRow(row: Record<string, unknown>): CreatorMonthlyMetrics {
  return {
    influencerId: String(row.influencer_id),
    platform: String(row.platform),
    periodMonth: String(row.period_month).slice(0, 10),
    followers: row.followers == null ? null : Number(row.followers),
    following: row.following == null ? null : Number(row.following),
    postsCount: row.posts_count == null ? null : Number(row.posts_count),
    avgViews: row.avg_views == null ? null : Number(row.avg_views),
    medianViews: row.median_views == null ? null : Number(row.median_views),
    engagementRate:
      row.engagement_rate == null ? null : Number(row.engagement_rate),
    postingFrequencyPerWeek:
      row.posting_frequency_per_week == null
        ? null
        : Number(row.posting_frequency_per_week),
    monthlyGrowthRate:
      row.monthly_growth_rate == null ? null : Number(row.monthly_growth_rate),
    followerDifference:
      row.follower_difference == null ? null : Number(row.follower_difference),
    sampleCaptureCount: Number(row.sample_capture_count ?? 0),
    source: String(row.source ?? "enrichment_capture"),
    computedAt: String(row.computed_at ?? row.created_at ?? ""),
  };
}

export async function loadCreatorMonthlyMetrics(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
    limitMonths?: number;
  }
): Promise<CreatorHistoricalMonthlySeries> {
  let query = supabase
    .from("creator_intelligence_monthly_metrics")
    .select(
      `
      influencer_id, platform, period_month,
      followers, following, posts_count,
      avg_views, median_views, engagement_rate, posting_frequency_per_week,
      monthly_growth_rate, follower_difference,
      sample_capture_count, source, computed_at, created_at
    `
    )
    .eq("influencer_id", input.influencerId)
    .order("period_month", { ascending: true })
    .limit(input.limitMonths ?? 36);

  if (input.platform) {
    query = query.eq("platform", input.platform);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error.message, error.code)) {
      return {
        influencerId: input.influencerId,
        platform: input.platform ?? null,
        months: [],
      };
    }
    throw new Error(error.message);
  }

  const months = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  return {
    influencerId: input.influencerId,
    platform: input.platform ?? months[0]?.platform ?? null,
    months,
  };
}

/** AI-ready hints — no AI execution. */
export function buildHistoricalAiHints(
  series: CreatorHistoricalMonthlySeries
): CreatorHistoricalAiHints {
  const latest = series.months[series.months.length - 1] ?? null;
  return {
    seriesAvailable: series.months.length > 0,
    monthCount: series.months.length,
    latestPeriodMonth: latest?.periodMonth ?? null,
    growthTrend: deriveGrowthTrend(series.months),
    recommendRefresh: series.months.length === 0,
  };
}
