import type { SupabaseClient } from "@supabase/supabase-js";



import {

  ftsRankMap,

  searchDiscoveredProfileIdsByQuery,

} from "@/lib/creators/fts-search";

import {
  applyCategoriesToArrayColumnQuery,
  resolveBrowseCategories,
} from "@/lib/creators/category-filter";

import { isSyntheticCreatorUsername } from "@/lib/discovery/demo-data";

import type {

  DiscoverySearchFilters,

  DiscoverySearchResult,

  ProfileAiScore,

  ProfileMetricsSnapshot,

} from "@/lib/discovery/types";



const DEFAULT_PAGE_SIZE = 24;



/** Escape `%` / `_` for safe use inside ilike patterns. */

function escapeIlikePattern(value: string): string {

  return value.replace(/[%_\\]/g, (char) => `\\${char}`);

}



async function searchDiscoveredProfileIdsByIlikeFallback(

  supabase: SupabaseClient,

  query: string,

  limit = 1000

): Promise<Array<{ id: string; rank: number }>> {

  const needle = query.trim().replace(/^@+/, "");

  if (!needle) return [];



  const pattern = `%${escapeIlikePattern(needle)}%`;

  const { data, error } = await supabase

    .from("discovered_profiles")

    .select("id, username, display_name")

    .is("influencer_id", null)

    .or(`username.ilike."${pattern}",display_name.ilike."${pattern}"`)

    .limit(limit);



  if (error) throw new Error(error.message);



  return (data ?? [])

    .filter((row) => !isSyntheticCreatorUsername(row.username as string | null))

    .map((row) => ({ id: row.id as string, rank: 0.001 }));

}



async function resolveDiscoveredProfileSearchIds(

  supabase: SupabaseClient,

  query: string

): Promise<Map<string, number>> {

  const primaryHits = await searchDiscoveredProfileIdsByQuery(supabase, query);

  const rankMap = ftsRankMap(primaryHits);

  const fallbackHits = await searchDiscoveredProfileIdsByIlikeFallback(supabase, query);

  for (const hit of fallbackHits) {

    if (!rankMap.has(hit.id)) rankMap.set(hit.id, hit.rank);

  }

  return rankMap;

}



export async function searchDiscoveredProfiles(

  supabase: SupabaseClient,

  filters: DiscoverySearchFilters & { profileIds?: string[] }

): Promise<DiscoverySearchResult> {

  const page = Math.max(1, filters.page ?? 1);

  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

  const from = (page - 1) * pageSize;

  const searchQuery = filters.q?.trim() ?? "";



  if (filters.profileIds?.length) {

    let query = supabase.from("discovered_profiles").select(

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

    `

    ).in("id", filters.profileIds);



    if (filters.platform) query = query.eq("platform", filters.platform);

    if (filters.country) {

      query = query.eq("country_code", filters.country.toUpperCase().slice(0, 2));

    }

    if (filters.categories?.length || filters.category) {
      query = applyCategoriesToArrayColumnQuery(
        query,
        "category_tags",
        resolveBrowseCategories(filters)
      );
    }



    const { data, error } = await query;

    if (error) throw new Error(error.message);



    const rows = mapDiscoveryRows(data ?? []);

    const rankById = searchQuery

      ? await resolveDiscoveredProfileSearchIds(supabase, searchQuery)

      : new Map<string, number>();

    const order = new Map(filters.profileIds.map((id, index) => [id, index]));

    rows.sort(

      (a, b) =>

        (rankById.get(b.id) ?? 0) - (rankById.get(a.id) ?? 0) ||

        (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)

    );



    return {

      profiles: rows.map((profile) => ({

        ...profile,

        search_rank: rankById.get(profile.id) ?? null,

      })),

      total: rows.length,

      page: 1,

      pageSize: rows.length,

    };

  }



  const rankByProfileId = searchQuery

    ? await resolveDiscoveredProfileSearchIds(supabase, searchQuery)

    : null;



  if (searchQuery && rankByProfileId && rankByProfileId.size === 0) {

    return { profiles: [], total: 0, page, pageSize };

  }



  let query = supabase.from("discovered_profiles").select(

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

    { count: searchQuery ? undefined : "exact" }

  );



  if (searchQuery && rankByProfileId) {

    query = query.in("id", [...rankByProfileId.keys()]);

  } else {

    query = query.order("updated_at", { ascending: false }).range(from, from + pageSize - 1);

  }



  if (filters.platform) {

    query = query.eq("platform", filters.platform);

  }

  if (filters.country) {

    query = query.eq("country_code", filters.country.toUpperCase().slice(0, 2));

  }

  if (filters.city) {

    query = query.ilike("city", `%${filters.city}%`);

  }

  if (filters.categories?.length || filters.category) {
    query = applyCategoriesToArrayColumnQuery(
      query,
      "category_tags",
      resolveBrowseCategories(filters)
    );
  }

  if (filters.language) {

    query = query.contains("language_codes", [filters.language]);

  }

  if (filters.stage) {

    query = query.eq("stage", filters.stage);

  }

  const { data, error, count } = await query;



  if (error) {

    throw new Error(error.message);

  }



  let profiles = mapDiscoveryRows(data ?? []);



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



  if (searchQuery && rankByProfileId) {

    profiles.sort(

      (a, b) =>

        (rankByProfileId.get(b.id) ?? 0) - (rankByProfileId.get(a.id) ?? 0)

    );

    const totalMatches = profiles.length;

    profiles = profiles.slice(from, from + pageSize);

    return {

      profiles: profiles.map((profile) => ({

        ...profile,

        search_rank: rankByProfileId.get(profile.id) ?? null,

      })),

      total: totalMatches,

      page,

      pageSize,

    };

  }



  return {

    profiles,

    total: count ?? profiles.length,

    page,

    pageSize,

  };

}



function mapDiscoveryRows(

  data: Array<

    Record<string, unknown> & {

      profile_metrics?: ProfileMetricsSnapshot[];

      profile_ai_scores?: ProfileAiScore[];

    }

  >

): DiscoverySearchResult["profiles"] {

  return data.map((row) => {

    const metrics =

      [...(row.profile_metrics ?? [])].sort(

        (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()

      )[0] ?? null;

    const ai =

      [...(row.profile_ai_scores ?? [])].sort(

        (a, b) => new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime()

      )[0] ?? null;



    const { profile_metrics: _m, profile_ai_scores: _a, ...profile } = row;

    return {

      ...(profile as DiscoverySearchResult["profiles"][number]),

      latest_metrics: metrics,

      latest_ai_score: ai,

    };

  });

}

