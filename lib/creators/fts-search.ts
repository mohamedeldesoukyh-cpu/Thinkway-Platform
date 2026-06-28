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

/** Escape `%` / `_` for safe use inside ilike patterns. */
function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

/**
 * Fallback handle/display-name match when FTS misses freshly imported creators
 * (search_vector not yet backfilled from platform account triggers).
 */
export async function searchInfluencerIdsByHandleFallback(
  supabase: SupabaseClient,
  query: string,
  limit = 100
): Promise<FtsRankHit[]> {
  const needle = query.trim().replace(/^@+/, "");
  if (!needle) return [];

  const pattern = `%${escapeIlikePattern(needle)}%`;
  const hits: FtsRankHit[] = [];
  const seen = new Set<string>();

  const { data: accountMatches, error: accountError } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, handle, username, normalized_username")
    .or(
      `handle.ilike."${pattern}",username.ilike."${pattern}",normalized_username.ilike."${pattern}"`
    )
    .limit(limit);

  if (accountError) throw new Error(accountError.message);

  for (const row of accountMatches ?? []) {
    const id = row.influencer_id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    hits.push({ id, rank: 0.001 });
  }

  const remaining = limit - hits.length;
  if (remaining <= 0) return hits;

  const { data: nameMatches, error: nameError } = await supabase
    .from("influencers")
    .select("id")
    .eq("status", "active")
    .ilike("display_name", pattern)
    .limit(remaining);

  if (nameError) throw new Error(nameError.message);

  for (const row of nameMatches ?? []) {
    const id = row.id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    hits.push({ id, rank: 0.001 });
  }

  return hits;
}
