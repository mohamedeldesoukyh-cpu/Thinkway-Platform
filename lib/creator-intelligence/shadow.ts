/**
 * Shadow comparison — legacy category filtering vs Creator Intelligence
 * matching, run side-by-side without changing behavior. The deltas quantify
 * migration impact BEFORE cutover (Phase 2 of the rollout).
 */
import { creatorMatchesBrowseCategories } from "@/lib/creators/category-filter";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { resolveCreatorIntelligence } from "./resolver";
import { categoriesIntersect } from "./taxonomy";

export type CategoryFilterShadowReport = {
  total: number;
  legacyPass: number;
  intelligencePass: number;
  /** Rejected by legacy tags but accepted by resolved intelligence. */
  recoveredByIntelligence: number;
  /** Accepted by legacy tags but rejected by resolved intelligence (provenance-only matches). */
  provenanceOnlyMatches: number;
  /** Creators whose intelligence categories are unresolved (enrichment gap). */
  unresolved: number;
};

/**
 * True when the creator's RESOLVED intelligence categories intersect the
 * requested ones (canonical, case-insensitive). Unknown (unresolved) → false
 * here; the report tracks unresolved separately so data gaps are visible
 * instead of silently zeroing pools.
 */
export function creatorIntelligenceMatchesCategories(
  creator: UnifiedCreatorResult,
  categories: string[]
): boolean {
  if (categories.length === 0) return true;
  const intelligence = resolveCreatorIntelligence(creator);
  return categoriesIntersect(intelligence.categories.value, categories);
}

/** Compare legacy vs CI category filtering over a candidate pool. */
export function compareCategoryFiltering(
  creators: ReadonlyArray<UnifiedCreatorResult>,
  categories: string[]
): CategoryFilterShadowReport {
  let legacyPass = 0;
  let intelligencePass = 0;
  let recoveredByIntelligence = 0;
  let provenanceOnlyMatches = 0;
  let unresolved = 0;

  for (const creator of creators) {
    const legacy = creatorMatchesBrowseCategories(creator, categories);
    const intelligence = resolveCreatorIntelligence(creator);
    const resolved = intelligence.categories.value.length > 0;
    const ci = resolved && categoriesIntersect(intelligence.categories.value, categories);

    if (legacy) legacyPass += 1;
    if (ci) intelligencePass += 1;
    if (!legacy && ci) recoveredByIntelligence += 1;
    if (legacy && !ci) provenanceOnlyMatches += 1;
    if (!resolved) unresolved += 1;
  }

  return {
    total: creators.length,
    legacyPass,
    intelligencePass,
    recoveredByIntelligence,
    provenanceOnlyMatches,
    unresolved,
  };
}
