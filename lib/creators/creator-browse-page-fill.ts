/**
 * Phase 1B-1 — shared candidate-window page-fill for Creator Search browse.
 *
 * Generalizes the audience-scan accumulate loop. Path adapters supply windows;
 * this module does not know about audience / platform / FTS / category specifics.
 *
 * Raw exhaustion MUST use rawCandidateCount (or upstream rawHasMore) — never
 * hydrated / qualified / post-filter lengths.
 */

import { browseCandidateQualificationActive } from "@/lib/creators/browse-candidate-qualification";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

/** Candidate IDs inspected per fill window (matches legacy audience batch). */
export const CREATOR_BROWSE_FILL_BATCH = 100;

/** Hard cap: at most ~1200 raw candidate IDs considered per fill request. */
export const CREATOR_BROWSE_MAX_FILL_WINDOWS = 12;

/**
 * Sparse post-filters (gender/age/lastPost) often yield long zero-match runs
 * because required hydrate fields are missing. After this many consecutive
 * full raw windows with zero matches, stop early (~300 IDs) rather than burn
 * the full 12-window budget. One empty window must not abort.
 */
export const CREATOR_BROWSE_SPARSE_ZERO_MATCH_WINDOW_LIMIT = 3;

export type CreatorBrowseFillWindow<T extends { unified_id: string }> = {
  /** Creators after hydrate (may already be Phase-1A-qualified). */
  creators: T[];
  /** Pool / upstream IDs retrieved BEFORE Phase 1A qualification. */
  rawCandidateCount: number;
  /**
   * Optional authoritative upstream signal that more raw candidates exist.
   * When false, the raw universe is exhausted even if rawCandidateCount === batchSize.
   */
  rawHasMore?: boolean;
};

export type CreatorBrowseFillPageResult<T extends { unified_id: string }> = {
  creators: T[];
  total: number;
  has_more: boolean;
  /** Diagnostics for tests / perf probes. */
  meta: {
    targetEnd: number;
    windowsFetched: number;
    rawIdsExamined: number;
    matchingBeforeSlice: number;
    rawExhausted: boolean;
    budgetExhausted: boolean;
    sparseEarlyStopped: boolean;
  };
};

/**
 * Raw pool window exhaustion — never use hydrated/match counts.
 */
export function isCreatorBrowseRawWindowExhausted(options: {
  rawCandidateCount: number;
  batchSize: number;
  rawHasMore?: boolean;
}): boolean {
  if (options.rawHasMore === false) return true;
  // Authoritative upstream "more exist" must win over a short window
  // (e.g. exact-handle FTS uses a smaller effective limit than FILL_BATCH).
  if (options.rawHasMore === true) return false;
  return options.rawCandidateCount < options.batchSize;
}

/**
 * True when filtered browse may shrink a fixed page window and must use fill.
 * Empty / default-only filters must stay on the unfiltered fast path.
 */
export function requiresCreatorBrowseCandidateFill(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  if (browseCandidateQualificationActive(filters)) return true;
  if ((filters.audienceCountries?.length ?? 0) > 0) return true;
  if ((filters.audienceInterestTags?.length ?? 0) > 0) return true;
  if ((filters.languages?.length ?? 0) > 1) return true;
  if ((filters.contentLanguages?.length ?? 0) > 0) return true;
  if (Boolean(filters.audienceGender?.trim())) return true;
  if (Boolean(filters.audienceAgeMin?.trim())) return true;
  if (Boolean(filters.audienceAgeMax?.trim())) return true;
  if ((filters.creatorCountries?.length ?? 0) > 1) return true;
  if (filters.lastPostWithin?.trim()) return true;
  if (filters.language?.trim()) return true;
  if (filters.minThinkwayScore != null) return true;
  return false;
}

/**
 * Sparse hydrate-dependent filters that routinely produce consecutive empty
 * windows on the recency pool. Dense hard filters (platform/metrics/country)
 * alone must not enable this guardrail.
 */
export function creatorBrowseSparseEarlyStopActive(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  return (
    Boolean(filters.audienceGender?.trim()) ||
    Boolean(filters.audienceAgeMin?.trim()) ||
    Boolean(filters.audienceAgeMax?.trim()) ||
    Boolean(filters.lastPostWithin?.trim())
  );
}

export function resolveCreatorBrowseFillMaxWindows(rawTotalEstimate: number): number {
  const fromEstimate = Math.max(1, Math.ceil(rawTotalEstimate / CREATOR_BROWSE_FILL_BATCH) + 2);
  return Math.min(CREATOR_BROWSE_MAX_FILL_WINDOWS, fromEstimate);
}

/**
 * Phase 1B-2 — filters that can shrink the FTS hit universe after retrieval.
 * Bare `q` alone must NOT trip this (raw FTS total_count may remain visible).
 * productionOnly is always on and is not treated as a structured shrink signal.
 */
export function creatorBrowseFtsStructuredShrinkActive(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  if (browseCandidateQualificationActive(filters)) return true;
  if (resolveBrowseCategoriesPresent(filters)) return true;
  if ((filters.audienceCountries?.length ?? 0) > 0) return true;
  if ((filters.audienceInterestTags?.length ?? 0) > 0) return true;
  if ((filters.languages?.length ?? 0) > 0) return true;
  if ((filters.contentLanguages?.length ?? 0) > 0) return true;
  if (Boolean(filters.language?.trim())) return true;
  if (Boolean(filters.audienceGender?.trim())) return true;
  if (Boolean(filters.audienceAgeMin?.trim())) return true;
  if (Boolean(filters.audienceAgeMax?.trim())) return true;
  if ((filters.creatorCountries?.length ?? 0) > 0) return true;
  if (Boolean(filters.country?.trim())) return true;
  if (filters.lastPostWithin?.trim()) return true;
  if (filters.minThinkwayScore != null) return true;
  if (filters.minAiScore != null) return true;
  return false;
}

function resolveBrowseCategoriesPresent(
  filters: Pick<UnifiedCreatorBrowseFilters, "categories" | "category">
): boolean {
  if ((filters.categories?.length ?? 0) > 0) return true;
  return Boolean(filters.category?.trim());
}

/**
 * FTS fill displayed total.
 * - Structured shrink → Phase 1B-1 fill total (never raw FTS total_count).
 * - Bare q → may retain raw FTS total_count when the RPC provided one.
 */
export function resolveCreatorBrowseFtsFillTotal(options: {
  structuredShrink: boolean;
  fillTotal: number;
  rawFtsTotalCount?: number | null;
  pageCreatorsLength: number;
}): number {
  if (options.structuredShrink) return options.fillTotal;
  const raw = options.rawFtsTotalCount;
  if (raw != null && Number.isFinite(raw) && raw >= 0) {
    return Math.max(raw, options.pageCreatorsLength);
  }
  return options.fillTotal;
}

/**
 * has_more after fill.
 *
 * Budget / sparse early-stop must NOT advertise Load More merely because raw
 * candidates remain — the next request restarts from window 1 and will hit the
 * same cap. Only known matching rows beyond the page slice imply has_more.
 */
export function resolveCreatorBrowseFillHasMore(options: {
  hasMoreMatchingBeyondPage: boolean;
  rawExhausted: boolean;
  budgetExhausted: boolean;
  sparseEarlyStopped: boolean;
}): boolean {
  if (options.hasMoreMatchingBeyondPage) return true;
  if (options.budgetExhausted || options.sparseEarlyStopped) return false;
  if (options.rawExhausted) return false;
  return true;
}

/**
 * Accumulate matching creators from ordered candidate windows until
 * targetEnd = page * pageSize, raw exhaustion, fill budget, or sparse early-stop.
 */
export async function accumulateCreatorBrowseFillPage<
  T extends { unified_id: string },
>(options: {
  page: number;
  pageSize: number;
  batchSize: number;
  maxWindows: number;
  fetchWindow: (windowIndex: number) => Promise<CreatorBrowseFillWindow<T>>;
  applyFilters: (creators: T[]) => T[];
  sort: (creators: T[]) => T[];
  /** When set, stop after this many consecutive zero-match full raw windows. */
  sparseZeroMatchWindowLimit?: number | null;
}): Promise<CreatorBrowseFillPageResult<T>> {
  const {
    page,
    pageSize,
    batchSize,
    maxWindows,
    fetchWindow,
    applyFilters,
    sort,
    sparseZeroMatchWindowLimit = null,
  } = options;

  const hardMaxWindows = Math.max(1, Math.min(maxWindows, CREATOR_BROWSE_MAX_FILL_WINDOWS));
  const sparseLimit =
    sparseZeroMatchWindowLimit != null && sparseZeroMatchWindowLimit > 0
      ? sparseZeroMatchWindowLimit
      : null;

  const filtered: T[] = [];
  let windowIndex = 1;
  let rawExhausted = false;
  let budgetExhausted = false;
  let sparseEarlyStopped = false;
  let consecutiveZeroMatchWindows = 0;
  let rawIdsExamined = 0;
  const targetEnd = page * pageSize;

  while (
    filtered.length < targetEnd &&
    !rawExhausted &&
    !sparseEarlyStopped &&
    windowIndex <= hardMaxWindows
  ) {
    const window = await fetchWindow(windowIndex);
    rawIdsExamined += Math.max(0, window.rawCandidateCount);

    if (window.rawCandidateCount === 0) {
      rawExhausted = true;
      break;
    }

    const matched = applyFilters(window.creators);
    filtered.push(...matched);

    if (sparseLimit != null) {
      if (matched.length === 0) {
        consecutiveZeroMatchWindows += 1;
        if (consecutiveZeroMatchWindows >= sparseLimit) {
          sparseEarlyStopped = true;
          windowIndex += 1;
          break;
        }
      } else {
        consecutiveZeroMatchWindows = 0;
      }
    }

    if (
      isCreatorBrowseRawWindowExhausted({
        rawCandidateCount: window.rawCandidateCount,
        batchSize,
        rawHasMore: window.rawHasMore,
      })
    ) {
      rawExhausted = true;
    }

    windowIndex += 1;
  }

  if (
    !rawExhausted &&
    !sparseEarlyStopped &&
    filtered.length < targetEnd &&
    windowIndex > hardMaxWindows
  ) {
    budgetExhausted = true;
  }

  const windowsFetched = windowIndex - 1;
  const uniqueFiltered = [...new Map(filtered.map((c) => [c.unified_id, c])).values()];
  const sorted = sort(uniqueFiltered);
  const offset = (page - 1) * pageSize;
  const pageCreators = sorted.slice(offset, offset + pageSize);
  const hasMoreMatchingBeyondPage = offset + pageCreators.length < sorted.length;
  const has_more = resolveCreatorBrowseFillHasMore({
    hasMoreMatchingBeyondPage,
    rawExhausted,
    budgetExhausted,
    sparseEarlyStopped,
  });

  // Exact total only when raw universe proven exhausted. Incomplete stops
  // (budget / sparse) report observed matches only — never invent exact totals.
  const total = rawExhausted
    ? sorted.length
    : has_more
      ? Math.max(sorted.length, offset + pageCreators.length + 1)
      : sorted.length;

  return {
    creators: pageCreators,
    total,
    has_more,
    meta: {
      targetEnd,
      windowsFetched,
      rawIdsExamined,
      matchingBeforeSlice: sorted.length,
      rawExhausted,
      budgetExhausted,
      sparseEarlyStopped,
    },
  };
}
