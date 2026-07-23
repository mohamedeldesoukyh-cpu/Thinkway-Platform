import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorHistoricalMetrics } from "@/lib/creators/types";
import { isMissingTableError } from "@/lib/platform/schema-validation";

export async function loadDiscoveryHistoricalMetrics(
  supabase: SupabaseClient,
  discoveredProfileId: string
): Promise<CreatorHistoricalMetrics> {
  const { data, error } = await supabase
    .from("profile_metrics")
    .select(
      "followers, engagement_rate, posting_frequency_per_week, captured_at"
    )
    .eq("profile_id", discoveredProfileId)
    .order("captured_at", { ascending: true })
    .limit(90);

  if (error) throw new Error(error.message);

  const rows = data ?? [];

  return {
    followers: rows.map((r) => ({
      captured_at: r.captured_at as string,
      value: Number(r.followers ?? 0),
    })),
    engagement_rate: rows
      .filter((r) => r.engagement_rate != null)
      .map((r) => ({
        captured_at: r.captured_at as string,
        value: Number(r.engagement_rate),
      })),
    posting_frequency: rows
      .filter((r) => r.posting_frequency_per_week != null)
      .map((r) => ({
        captured_at: r.captured_at as string,
        value: Number(r.posting_frequency_per_week),
      })),
  };
}

export async function loadInternalHistoricalMetrics(
  supabase: SupabaseClient,
  influencerId: string
): Promise<CreatorHistoricalMetrics> {
  const { data, error } = await supabase
    .from("influencer_metrics_history")
    .select(
      "followers, engagement_rate, posting_frequency_per_week, captured_at"
    )
    .eq("influencer_id", influencerId)
    .order("captured_at", { ascending: true })
    .limit(90);

  if (error) {
    // Table may exist in migrations but not yet applied locally (PostgREST PGRST205).
    if (isMissingTableError(error.message, error.code)) {
      return { followers: [], engagement_rate: [], posting_frequency: [] };
    }
    throw new Error(error.message);
  }

  const rows = data ?? [];

  return {
    followers: rows.map((r) => ({
      captured_at: r.captured_at as string,
      value: Number(r.followers ?? 0),
    })),
    engagement_rate: rows
      .filter((r) => r.engagement_rate != null)
      .map((r) => ({
        captured_at: r.captured_at as string,
        value: Number(r.engagement_rate),
      })),
    posting_frequency: rows
      .filter((r) => r.posting_frequency_per_week != null)
      .map((r) => ({
        captured_at: r.captured_at as string,
        value: Number(r.posting_frequency_per_week),
      })),
  };
}

export async function loadCreatorHistoricalMetrics(
  supabase: SupabaseClient,
  unifiedId: string
): Promise<CreatorHistoricalMetrics> {
  const [kind, id] = unifiedId.split(":");
  if (!id) {
    return { followers: [], engagement_rate: [], posting_frequency: [] };
  }
  if (kind === "dis") return loadDiscoveryHistoricalMetrics(supabase, id);
  if (kind === "inf") return loadInternalHistoricalMetrics(supabase, id);
  return { followers: [], engagement_rate: [], posting_frequency: [] };
}
