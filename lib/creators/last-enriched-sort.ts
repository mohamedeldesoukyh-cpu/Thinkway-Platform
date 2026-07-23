import { compareBrowseDefaultOrder } from "@/lib/creators/browse-pin-tier";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

const DAY_MS = 86_400_000;

export type CreatorBrowseRecencyFields = Pick<
  UnifiedCreatorResult,
  "last_enriched_at" | "updated_at"
>;

/** Enrichment timestamp first; fall back to row `updated_at` for newly added creators. */
export function resolveCreatorBrowseRecencyIso(
  creator: CreatorBrowseRecencyFields
): string | null {
  return creator.last_enriched_at ?? creator.updated_at ?? null;
}

/** Whole days elapsed since `last_enriched_at`; null when missing or invalid. */
export function daysSinceLastEnriched(
  iso: string | null | undefined,
  nowMs: number = Date.now()
): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  return Math.floor(Math.max(0, nowMs - ts) / DAY_MS);
}

/**
 * Sort by update recency: smallest days-since first (most recent), never-updated last.
 * `desc` = most recently updated first; `asc` = oldest updated first (never still last).
 */
export function compareByLastEnrichedRecency(
  a: CreatorBrowseRecencyFields,
  b: CreatorBrowseRecencyFields,
  direction: "asc" | "desc" = "desc",
  nowMs: number = Date.now()
): number {
  const daysA = daysSinceLastEnriched(resolveCreatorBrowseRecencyIso(a), nowMs);
  const daysB = daysSinceLastEnriched(resolveCreatorBrowseRecencyIso(b), nowMs);

  if (daysA === null && daysB === null) return 0;
  if (daysA === null) return 1;
  if (daysB === null) return -1;

  const delta = daysA - daysB;
  return direction === "desc" ? delta : -delta;
}

type BrowseRecencyTiebreak = CreatorBrowseRecencyFields &
  Pick<UnifiedCreatorResult, "country_code" | "enrichment_status"> &
  Partial<
    Pick<UnifiedCreatorResult, "estimated_country" | "platforms" | "country_codes">
  > & {
    thinkway_score?: number | null;
    unified_id?: string;
  };

/** Server-side default browse ordering — Egypt pin tiers, recency, then quality. */
export function compareBrowseRecencyDesc(
  a: BrowseRecencyTiebreak,
  b: BrowseRecencyTiebreak,
  nowMs: number = Date.now()
): number {
  return compareBrowseDefaultOrder(a, b, "desc", nowMs);
}
