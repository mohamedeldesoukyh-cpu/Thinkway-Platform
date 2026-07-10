import type { UnifiedCreatorResult } from "@/lib/creators/types";

/**
 * Cap on the merged AI candidate pool (two browse pages of AI_CAMPAIGN_PAGE_SIZE).
 * Relevance ranking runs client-side over this pool.
 */
export const AI_CANDIDATE_POOL_LIMIT = 400;

/**
 * Merge the strict-filtered and relaxed browse pools for AI campaign search.
 *
 * The relaxed pool (platform-only SQL filter) is ordered by thinkway_score, a
 * data-quality proxy — on-brief creators outside its top page never reach the
 * relevance ranker. The strict pool applies the brief's real filters in SQL, so
 * on-brief creators enter the candidate pool regardless of enrichment rank.
 * Strict results are kept first so they survive dedupe.
 */
export function mergeAiCandidatePools(
  strict: UnifiedCreatorResult[],
  relaxed: UnifiedCreatorResult[],
  limit: number = AI_CANDIDATE_POOL_LIMIT
): UnifiedCreatorResult[] {
  const merged: UnifiedCreatorResult[] = [];
  const seen = new Set<string>();
  for (const creator of [...strict, ...relaxed]) {
    if (!creator?.unified_id || seen.has(creator.unified_id)) continue;
    seen.add(creator.unified_id);
    merged.push(creator);
    if (merged.length >= limit) break;
  }
  return merged;
}
