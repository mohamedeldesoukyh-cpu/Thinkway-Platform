import { countCreatorPlatforms } from "@/lib/creators/browse-quality-sort";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import { compareEnrichmentSortRank } from "@/lib/creators/enrichment-sort-rank";
import {
  compareByLastEnrichedRecency,
  resolveCreatorBrowseRecencyIso,
} from "@/lib/creators/last-enriched-sort";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

/** Priority country for Discovery browse pin tier 0 (Egypt-first). */
export const BROWSE_PIN_PRIORITY_COUNTRY = "EG";

type BrowsePinFields = Pick<
  UnifiedCreatorResult,
  "country_code" | "last_enriched_at" | "updated_at" | "enrichment_status"
> &
  Partial<
    Pick<UnifiedCreatorResult, "country_codes" | "estimated_country" | "platforms">
  >;

function creatorCountryCodes(creator: BrowsePinFields): string[] {
  return resolveCreatorCountryCodes({
    country_codes: creator.country_codes,
    country_code: creator.country_code,
    estimated_country: creator.estimated_country,
    platformAudienceCountries: (creator.platforms ?? []).map(
      (platform) => platform.audience_country
    ),
  });
}

export function isBrowsePinPriorityCountry(
  creator: BrowsePinFields,
  countryCode: string = BROWSE_PIN_PRIORITY_COUNTRY
): boolean {
  const target = resolveCountryCode(countryCode);
  if (!target) return false;
  return creatorCountryCodes(creator).includes(target);
}

export function hasBrowseRecencyUpdate(
  creator: Pick<UnifiedCreatorResult, "last_enriched_at" | "updated_at">
): boolean {
  return resolveCreatorBrowseRecencyIso(creator) != null;
}

export function hasBrowseFullData(
  creator: Pick<UnifiedCreatorResult, "enrichment_status">
): boolean {
  return (creator.enrichment_status ?? "never") === "enriched";
}

export function hasBrowseMultiPlatform(
  creator: Partial<Pick<UnifiedCreatorResult, "platforms">>
): boolean {
  return countCreatorPlatforms(creator) >= 2;
}

/**
 * Discovery browse pin tiers (lower = higher on page):
 * 0 — Egypt + last updated + multi-platform + full data
 * 1 — last updated + multi-platform + full data
 * 2 — last updated + full data
 * 3 — full data only
 * 4 — last updated only
 * 5 — others
 */
export function browsePinTier(
  creator: BrowsePinFields,
  priorityCountry: string = BROWSE_PIN_PRIORITY_COUNTRY
): number {
  const priority = isBrowsePinPriorityCountry(creator, priorityCountry);
  const updated = hasBrowseRecencyUpdate(creator);
  const multi = hasBrowseMultiPlatform(creator);
  const full = hasBrowseFullData(creator);

  if (priority && updated && multi && full) return 0;
  if (updated && multi && full) return 1;
  if (updated && full) return 2;
  if (full) return 3;
  if (updated) return 4;
  return 5;
}

export function compareBrowsePinTier(
  a: BrowsePinFields,
  b: BrowsePinFields,
  priorityCountry: string = BROWSE_PIN_PRIORITY_COUNTRY
): number {
  return browsePinTier(a, priorityCountry) - browsePinTier(b, priorityCountry);
}

function compareMultiPlatformCount(
  a: Partial<Pick<UnifiedCreatorResult, "platforms">>,
  b: Partial<Pick<UnifiedCreatorResult, "platforms">>
): number {
  return countCreatorPlatforms(b) - countCreatorPlatforms(a);
}

type BrowseDefaultOrderFields = BrowsePinFields & {
  thinkway_score?: number | null;
  unified_id?: string;
};

/** Default Discovery browse ordering — pin tiers, then recency and quality signals. */
export function compareBrowseDefaultOrder(
  a: BrowseDefaultOrderFields,
  b: BrowseDefaultOrderFields,
  direction: "asc" | "desc" = "desc",
  nowMs: number = Date.now(),
  priorityCountry: string = BROWSE_PIN_PRIORITY_COUNTRY
): number {
  const tier = compareBrowsePinTier(a, b, priorityCountry);
  if (tier !== 0) return tier;

  const recency = compareByLastEnrichedRecency(a, b, direction, nowMs);
  if (recency !== 0) return recency;

  const multi = compareMultiPlatformCount(a, b);
  if (multi !== 0) return multi;

  const enrichment = compareEnrichmentSortRank(a, b);
  if (enrichment !== 0) return enrichment;

  const leftIso = resolveCreatorBrowseRecencyIso(a);
  const rightIso = resolveCreatorBrowseRecencyIso(b);
  const left = leftIso ? Date.parse(leftIso) : 0;
  const right = rightIso ? Date.parse(rightIso) : 0;
  const timestampDelta = direction === "desc" ? right - left : left - right;
  if (timestampDelta !== 0) return timestampDelta;

  const scoreDelta = (b.thinkway_score ?? 0) - (a.thinkway_score ?? 0);
  if (scoreDelta !== 0) return scoreDelta;

  return (a.unified_id ?? "").localeCompare(b.unified_id ?? "");
}

/** Minimum hydrated rows considered for page-1 pin-tier ordering. */
export const BROWSE_PIN_SORT_POOL_MIN = 120;

export const BROWSE_PIN_SORT_POOL_MAX = 250;

/** Extra Egypt pool merged into page-1 sort (kept small to avoid Supabase overload). */
export const BROWSE_PIN_PRIORITY_POOL_SIZE = 60;

export function resolveBrowseSortPoolSize(page: number, pageSize: number): number {
  const base = page * pageSize;
  const minimum = page === 1 ? BROWSE_PIN_SORT_POOL_MIN : base;
  return Math.min(Math.max(base, minimum), BROWSE_PIN_SORT_POOL_MAX);
}

/**
 * Whether another page can be sliced from the in-memory sorted browse pool.
 * Must not use catalog totals — the pool is capped at {@link BROWSE_PIN_SORT_POOL_MAX},
 * so comparing against catalog size falsely keeps `has_more` true after the pool ends.
 */
export function browseSortedPoolHasMore(
  offset: number,
  pageLength: number,
  poolLength: number
): boolean {
  return offset + pageLength < poolLength;
}

export function sortBrowseCreatorsInDefaultOrder<T extends BrowseDefaultOrderFields>(
  creators: T[],
  direction: "asc" | "desc" = "desc",
  nowMs: number = Date.now(),
  priorityCountry: string = BROWSE_PIN_PRIORITY_COUNTRY
): T[] {
  return [...creators].sort((a, b) =>
    compareBrowseDefaultOrder(a, b, direction, nowMs, priorityCountry)
  );
}

export function paginateBrowseCreators<T>(
  creators: readonly T[],
  page: number,
  pageSize: number
): T[] {
  const offset = (page - 1) * pageSize;
  return creators.slice(offset, offset + pageSize);
}
