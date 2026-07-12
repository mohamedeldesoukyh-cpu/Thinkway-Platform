import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import { normalizeTierLabel } from "../creator-slate";

/** Follower band for a tier label — used to search Discovery for replacements. */
export function tierFollowerRange(tier: string): {
  minFollowers?: number;
  maxFollowers?: number;
} {
  switch (normalizeTierLabel(tier)) {
    case "Celebrity":
      return { minFollowers: 5_000_000 };
    case "Macro":
      return { minFollowers: 1_000_000, maxFollowers: 4_999_999 };
    case "Mid-Tier":
      return { minFollowers: 50_000, maxFollowers: 999_999 };
    case "Micro":
      return { minFollowers: 10_000, maxFollowers: 49_999 };
    case "Nano":
      return { maxFollowers: 9_999 };
    default:
      return {};
  }
}

export function creatorCity(creator: UnifiedCreatorResult): string | null {
  return creator.city?.trim() || null;
}

export function creatorCountry(creator: UnifiedCreatorResult): string | null {
  return creator.country_code?.trim() || creator.estimated_country?.trim() || null;
}

export function creatorEngagementRate(creator: UnifiedCreatorResult): number | null {
  return creator.metrics?.engagement_rate?.value ?? null;
}

function textMatches(value: string | null, query: string): boolean {
  if (!value) return false;
  const a = value.toLowerCase();
  const b = query.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

export type SlateRemovalCriteria = {
  city?: string;
  country?: string;
  /** Remove creators BELOW this engagement rate (%). */
  belowEngagement?: number;
};

/** True when a creator should be removed under the given attribute criteria. */
export function creatorMatchesRemoval(
  creator: UnifiedCreatorResult,
  criteria: SlateRemovalCriteria
): boolean {
  if (criteria.city && textMatches(creatorCity(creator), criteria.city)) return true;
  if (criteria.country && textMatches(creatorCountry(creator), criteria.country)) return true;
  if (criteria.belowEngagement != null) {
    const er = creatorEngagementRate(creator);
    if (er != null && er < criteria.belowEngagement) return true;
  }
  return false;
}

/** Creators from the hydrated slate that match the removal criteria. */
export function selectSlateCreatorsToRemove(
  creators: UnifiedCreatorResult[],
  criteria: SlateRemovalCriteria
): UnifiedCreatorResult[] {
  if (!criteria.city && !criteria.country && criteria.belowEngagement == null) return [];
  return creators.filter((creator) => creatorMatchesRemoval(creator, criteria));
}

/**
 * Pick up to `count` search results to add, excluding any already in the slate
 * and any duplicates within the results. Discovery already ranks by relevance,
 * so we keep its order.
 */
export function selectCreatorsToAdd(
  candidates: UnifiedCreatorResult[],
  existingNormalizedIds: Set<string>,
  count: number
): UnifiedCreatorResult[] {
  const picked: UnifiedCreatorResult[] = [];
  const seen = new Set(existingNormalizedIds);
  for (const creator of candidates) {
    const key = creator.unified_id.replace(/^inf:/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(creator);
    if (picked.length >= count) break;
  }
  return picked;
}
