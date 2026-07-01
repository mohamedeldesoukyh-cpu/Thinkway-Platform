import type { SupabaseClient } from "@supabase/supabase-js";

export type FtsRankHit = {
  id: string;
  rank: number;
};

export type CreatorSearchHit = {
  source_type: "influencer" | "discovered";
  creator_id: string;
  rank: number;
  has_more: boolean;
};

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;

export async function searchCreators(
  supabase: SupabaseClient,
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
  offset = 0
): Promise<CreatorSearchHit[]> {
  const cappedLimit = Math.min(Math.max(limit, 0), MAX_SEARCH_LIMIT);
  const cappedOffset = Math.max(offset, 0);

  const { data, error } = await supabase.rpc("search_creators", {
    p_query: query.trim(),
    p_limit: cappedLimit,
    p_offset: cappedOffset,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map(
    (row: {
      source_type: string;
      creator_id: string;
      rank: number;
      has_more: boolean;
    }) => ({
      source_type: row.source_type === "discovered" ? "discovered" : "influencer",
      creator_id: row.creator_id,
      rank: row.rank,
      has_more: Boolean(row.has_more),
    })
  );
}

export async function searchCreatorsCount(
  supabase: SupabaseClient,
  query: string
): Promise<number> {
  const { data, error } = await supabase.rpc("search_creators_count", {
    p_query: query.trim(),
  });

  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : Number(data ?? 0);
}

export function creatorSearchRankMap(
  hits: CreatorSearchHit[]
): Map<string, number> {
  return new Map(
    hits.map((hit) => [`${hit.source_type}:${hit.creator_id}`, hit.rank])
  );
}

export function creatorSearchHasMore(hits: CreatorSearchHit[]): boolean {
  return hits[0]?.has_more ?? false;
}

/** Resolve influencer IDs + ranks via unified search (no FTS short-circuit). */
export async function searchInfluencerIdsByQuery(
  supabase: SupabaseClient,
  query: string,
  limit = DEFAULT_SEARCH_LIMIT
): Promise<FtsRankHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const hits = await searchCreators(supabase, trimmed, limit, 0);
  return hits
    .filter((hit) => hit.source_type === "influencer")
    .map((hit) => ({ id: hit.creator_id, rank: hit.rank }));
}

/** Resolve discovered profile IDs + ranks via unified search. */
export async function searchDiscoveredProfileIdsByQuery(
  supabase: SupabaseClient,
  query: string,
  limit = DEFAULT_SEARCH_LIMIT
): Promise<FtsRankHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const hits = await searchCreators(supabase, trimmed, limit, 0);
  return hits
    .filter((hit) => hit.source_type === "discovered")
    .map((hit) => ({ id: hit.creator_id, rank: hit.rank }));
}

/** @deprecated Prefer searchInfluencerIdsByQuery — kept for legacy callers. */
export async function searchInfluencerIdsByFts(
  supabase: SupabaseClient,
  query: string,
  limit = 500
): Promise<FtsRankHit[]> {
  return searchInfluencerIdsByQuery(supabase, query, limit);
}

/** @deprecated Prefer searchDiscoveredProfileIdsByQuery — kept for legacy callers. */
export async function searchDiscoveredProfileIdsByFts(
  supabase: SupabaseClient,
  query: string,
  limit = 500
): Promise<FtsRankHit[]> {
  return searchDiscoveredProfileIdsByQuery(supabase, query, limit);
}

export function ftsRankMap(hits: FtsRankHit[]): Map<string, number> {
  return new Map(hits.map((hit) => [hit.id, hit.rank]));
}

/** Escape `%` / `_` for safe use inside ilike patterns. */
function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

/**
 * Fallback handle/display-name match when search_vector is stale.
 * Unified search_creators covers most cases; this remains for edge post-import gaps.
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
    .select("influencer_id, handle, username, normalized_username, profile_display_name")
    .or(
      `handle.ilike."${pattern}",username.ilike."${pattern}",normalized_username.ilike."${pattern}",profile_display_name.ilike."${pattern}"`
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
    .or(`display_name.ilike."${pattern}",legal_name.ilike."${pattern}"`)
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
