import type { SupabaseClient } from "@supabase/supabase-js";

import { isSyntheticCreatorUsername } from "@/lib/discovery/demo-data";
import type {
  DiscoverySearchFilters,
  DiscoverySearchResult,
  ProfileAiScore,
  ProfileMetricsSnapshot,
} from "@/lib/discovery/types";

const DEFAULT_PAGE_SIZE = 24;

export async function searchDiscoveredProfiles(
  supabase: SupabaseClient,
  filters: DiscoverySearchFilters
): Promise<DiscoverySearchResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("discovered_profiles")
    .select(
      `
      *,
      profile_metrics (
        followers, following, posts_count, avg_likes, avg_comments,
        engagement_rate, avg_views, posting_frequency_per_week,
        reels_views_avg, captured_at
      ),
      profile_ai_scores (
        category, niche, audience_type, content_quality_score,
        luxury_level_score, brand_fit_score, professionalism_score,
        influencer_summary, audience_persona, content_style, scored_at
      )
    `,
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filters.platform) {
    query = query.eq("platform", filters.platform);
  }
  if (filters.country) {
    query = query.eq("country_code", filters.country.toUpperCase().slice(0, 2));
  }
  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }
  if (filters.category) {
    query = query.contains("category_tags", [filters.category]);
  }
  if (filters.language) {
    query = query.contains("language_codes", [filters.language]);
  }
  if (filters.stage) {
    query = query.eq("stage", filters.stage);
  }
  if (filters.q?.trim()) {
    query = query.textSearch("search_vector", filters.q.trim(), {
      type: "websearch",
      config: "simple",
    });
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<
    Record<string, unknown> & {
      profile_metrics?: ProfileMetricsSnapshot[];
      profile_ai_scores?: ProfileAiScore[];
    }
  >;

  let profiles = rows.map((row) => {
    const metrics = [...(row.profile_metrics ?? [])].sort(
      (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
    )[0] ?? null;
    const ai = [...(row.profile_ai_scores ?? [])].sort(
      (a, b) => new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime()
    )[0] ?? null;

    const { profile_metrics: _m, profile_ai_scores: _a, ...profile } = row;
    return {
      ...(profile as DiscoverySearchResult["profiles"][number]),
      latest_metrics: metrics,
      latest_ai_score: ai,
    };
  });

  // Defensive guard (review item 9): synthetic/demo/mock/seed creators must never
  // surface in discovery, in ANY environment, even if a legacy row exists.
  profiles = profiles.filter(
    (p) => !isSyntheticCreatorUsername((p as { username?: string | null }).username)
  );

  if (filters.minFollowers != null) {
    profiles = profiles.filter(
      (p) => (p.latest_metrics?.followers ?? 0) >= filters.minFollowers!
    );
  }
  if (filters.maxFollowers != null) {
    profiles = profiles.filter(
      (p) => (p.latest_metrics?.followers ?? Number.MAX_SAFE_INTEGER) <= filters.maxFollowers!
    );
  }
  if (filters.minEngagement != null) {
    profiles = profiles.filter(
      (p) => (p.latest_metrics?.engagement_rate ?? 0) >= filters.minEngagement!
    );
  }
  if (filters.minViews != null) {
    profiles = profiles.filter(
      (p) => (p.latest_metrics?.avg_views ?? 0) >= filters.minViews!
    );
  }

  return {
    profiles,
    total: count ?? profiles.length,
    page,
    pageSize,
  };
}
