import type { SupabaseClient } from "@supabase/supabase-js";

export type FtsRankHit = {
  id: string;
  rank: number;
};

export async function searchInfluencerIdsByFts(
  supabase: SupabaseClient,
  query: string,
  limit = 500
): Promise<FtsRankHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase.rpc("search_influencers_fts", {
    search_query: trimmed,
    result_limit: limit,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: { influencer_id: string; rank: number }) => ({
    id: row.influencer_id,
    rank: row.rank,
  }));
}

export async function searchDiscoveredProfileIdsByFts(
  supabase: SupabaseClient,
  query: string,
  limit = 500
): Promise<FtsRankHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase.rpc("search_discovered_profiles_fts", {
    search_query: trimmed,
    result_limit: limit,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: { profile_id: string; rank: number }) => ({
    id: row.profile_id,
    rank: row.rank,
  }));
}

export function ftsRankMap(hits: FtsRankHit[]): Map<string, number> {
  return new Map(hits.map((hit) => [hit.id, hit.rank]));
}
