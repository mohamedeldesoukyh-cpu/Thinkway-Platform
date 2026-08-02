import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeFollowerDifference,
  computeMonthlyGrowthRate,
} from "@/lib/enterprise-creator-intelligence/historical/compute";
import {
  previousPeriodMonth,
  toPeriodMonth,
} from "@/lib/enterprise-creator-intelligence/historical/period";
import type { CreatorMetricsCaptureInput } from "@/lib/enterprise-creator-intelligence/historical/types";

/**
 * Upsert the monthly projection for the capture's month.
 * Prior months' raw captures are never deleted.
 * Growth / follower difference are derived from the prior month row.
 */
export async function upsertMonthlyMetricsFromCapture(
  supabase: SupabaseClient,
  input: CreatorMetricsCaptureInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const periodMonth = toPeriodMonth(input.capturedAt ?? new Date());
  const priorMonth = previousPeriodMonth(periodMonth);

  const { data: priorRow } = await supabase
    .from("creator_intelligence_monthly_metrics")
    .select("followers")
    .eq("influencer_id", input.influencerId)
    .eq("platform", input.platform)
    .eq("period_month", priorMonth)
    .maybeSingle();

  const priorFollowers =
    priorRow && (priorRow as { followers: number | null }).followers != null
      ? Number((priorRow as { followers: number | null }).followers)
      : null;

  const followerDifference = computeFollowerDifference(
    input.followers,
    priorFollowers
  );
  const monthlyGrowthRate = computeMonthlyGrowthRate(
    input.followers,
    priorFollowers
  );

  const { data: existing } = await supabase
    .from("creator_intelligence_monthly_metrics")
    .select("id, sample_capture_count")
    .eq("influencer_id", input.influencerId)
    .eq("platform", input.platform)
    .eq("period_month", periodMonth)
    .maybeSingle();

  const sampleCaptureCount = existing
    ? Number((existing as { sample_capture_count: number }).sample_capture_count ?? 0) +
      1
    : 1;

  const payload = {
    influencer_id: input.influencerId,
    platform: input.platform,
    period_month: periodMonth,
    followers: input.followers,
    following: input.following,
    posts_count: input.postsCount,
    avg_views: input.avgViews,
    median_views: input.medianViews,
    engagement_rate: input.engagementRate,
    posting_frequency_per_week: input.postingFrequencyPerWeek,
    monthly_growth_rate: monthlyGrowthRate,
    follower_difference: followerDifference,
    sample_capture_count: sampleCaptureCount,
    source: input.source ?? "enrichment_capture",
    ipl_snapshot_id: input.iplSnapshotId ?? null,
    metadata: input.metadata ?? {},
    computed_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("creator_intelligence_monthly_metrics")
      .update(payload as never)
      .eq("id", (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase
    .from("creator_intelligence_monthly_metrics")
    .insert(payload as never);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
