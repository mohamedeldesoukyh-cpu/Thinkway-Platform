import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApifyProfileData } from "@/lib/creator-enrichment/types";
import {
  computeMedian,
  computePostingFrequencyPerWeek,
} from "@/lib/enterprise-creator-intelligence/historical/compute";
import { upsertMonthlyMetricsFromCapture } from "@/lib/enterprise-creator-intelligence/historical/rollup-monthly";
import type { CreatorMetricsCaptureInput } from "@/lib/enterprise-creator-intelligence/historical/types";

/**
 * Append-only raw capture. Never updates prior history rows.
 */
export async function appendCreatorMetricsCapture(
  supabase: SupabaseClient,
  input: CreatorMetricsCaptureInput
): Promise<{ ok: true; captureId: string } | { ok: false; error: string }> {
  const capturedAt = input.capturedAt
    ? new Date(input.capturedAt).toISOString()
    : new Date().toISOString();

  const { data, error } = await supabase
    .from("influencer_metrics_history")
    .insert({
      influencer_id: input.influencerId,
      platform: input.platform,
      followers: input.followers,
      following: input.following,
      posts_count: input.postsCount,
      avg_views: input.avgViews,
      median_views: input.medianViews,
      engagement_rate: input.engagementRate,
      posting_frequency_per_week: input.postingFrequencyPerWeek,
      captured_at: capturedAt,
      source: input.source ?? "enterprise_creator_intelligence",
      metadata: {
        ...(input.metadata ?? {}),
        ipl_snapshot_id: input.iplSnapshotId ?? null,
      },
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Failed to append creator metrics capture.",
    };
  }

  const captureId = (data as { id: string }).id;

  // Monthly projection (derived) — does not delete or mutate raw captures.
  await upsertMonthlyMetricsFromCapture(supabase, {
    ...input,
    capturedAt,
  });

  return { ok: true, captureId };
}

/** Build capture input from a normalized IPL / Apify profile snapshot. */
export function captureInputFromNormalizedProfile(input: {
  influencerId: string;
  platform: string;
  normalized: ApifyProfileData;
  iplSnapshotId?: string | null;
  capturedAt?: string;
  source?: string;
}): CreatorMetricsCaptureInput {
  const pubs = input.normalized.recentPublications ?? [];
  const views = pubs.map((p) => p.views);
  const medianViews = computeMedian(views);
  const postingFrequency = computePostingFrequencyPerWeek(
    pubs.map((p) => p.posted_at)
  );

  return {
    influencerId: input.influencerId,
    platform: input.platform || input.normalized.platform || "unknown",
    capturedAt: input.capturedAt,
    followers: input.normalized.followers,
    following: input.normalized.following,
    postsCount: input.normalized.postsCount,
    avgViews: input.normalized.avgViews,
    medianViews,
    engagementRate: input.normalized.engagementRate,
    postingFrequencyPerWeek: postingFrequency,
    source: input.source ?? "ipl_snapshot",
    iplSnapshotId: input.iplSnapshotId ?? null,
    metadata: {
      publication_sample_size: pubs.length,
      username: input.normalized.username,
    },
  };
}
