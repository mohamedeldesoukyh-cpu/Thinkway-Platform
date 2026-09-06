/**
 * Phase 1A — candidate ID qualification before creator hydration.
 *
 * Intersects an ordered candidate ID list with:
 *   platform account matches (OR within platforms)
 *   creator country matches (OR within countries)
 *   follower / engagement / minViews account metrics
 *
 * Preserves candidate order. No work when filters are inactive (unfiltered fast path).
 * Does not implement page-fill (Phase 1B).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveCountryCode } from "@/lib/creators/country-code";
import { applyInfluencerCountriesBrowseFilter } from "@/lib/creators/country-inference";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";
import { resolveDiscoveryPlatform } from "@/lib/social/platforms";

const IN_FILTER_BATCH_SIZE = 80;

function chunkValues<T>(values: T[], size: number): T[][] {
  if (values.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/** Canonical platform keys from singular + multi browse fields. */
export function resolveBrowsePlatformKeys(
  filters: Pick<UnifiedCreatorBrowseFilters, "platform" | "platforms">
): string[] {
  const raw = [
    ...(filters.platform?.trim() ? [filters.platform.trim()] : []),
    ...(filters.platforms ?? []),
  ];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const value of raw) {
    const platform = resolveDiscoveryPlatform(value) ?? value.trim().toLowerCase();
    if (!platform || seen.has(platform)) continue;
    seen.add(platform);
    keys.push(platform);
  }
  return keys;
}

/**
 * Creator-location codes for ID-stage OR.
 * Prefers `creatorCountries`; falls back to singular `country`.
 */
export function resolveBrowseCreatorCountryCodes(
  filters: Pick<UnifiedCreatorBrowseFilters, "country" | "creatorCountries">
): string[] {
  const raw =
    filters.creatorCountries?.length
      ? filters.creatorCountries
      : filters.country?.trim()
        ? [filters.country.trim()]
        : [];
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const value of raw) {
    const code = normalizeCountryCode(resolveCountryCode(value));
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

export function browseAccountQualificationActive(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  return (
    resolveBrowsePlatformKeys(filters).length > 0 ||
    filters.minFollowers != null ||
    filters.maxFollowers != null ||
    filters.minEngagement != null ||
    filters.minViews != null
  );
}

export function browseCreatorCountryQualificationActive(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  return resolveBrowseCreatorCountryCodes(filters).length > 0;
}

export function browseCandidateQualificationActive(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  return (
    browseAccountQualificationActive(filters) ||
    browseCreatorCountryQualificationActive(filters)
  );
}

/**
 * Preserve `ordered` sequence; keep only IDs present in `allowed`.
 */
export function intersectOrderedIds(
  ordered: readonly string[],
  allowed: ReadonlySet<string>
): string[] {
  if (ordered.length === 0 || allowed.size === 0) return [];
  return ordered.filter((id) => allowed.has(id));
}

/**
 * Account-stage qualification: influencer qualifies if ANY linked platform account
 * matches the combined platform + metric predicates (same AND-on-account semantics
 * as the historical singular-platform prefilter).
 */
async function fetchAccountQualifiedInfluencerIdSet(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  platforms: string[],
  candidateIds: string[]
): Promise<Set<string>> {
  const qualified = new Set<string>();
  if (candidateIds.length === 0) return qualified;

  for (const chunk of chunkValues(candidateIds, IN_FILTER_BATCH_SIZE)) {
    let accountQuery = supabase
      .from("influencer_platform_accounts")
      .select("influencer_id")
      .in("influencer_id", chunk);

    if (platforms.length === 1) {
      accountQuery = accountQuery.eq("platform", platforms[0]!);
    } else if (platforms.length > 1) {
      accountQuery = accountQuery.in("platform", platforms);
    }

    if (filters.minFollowers != null) {
      accountQuery = accountQuery.gte("follower_count", filters.minFollowers);
    }
    if (filters.maxFollowers != null) {
      accountQuery = accountQuery.lte("follower_count", filters.maxFollowers);
    }
    if (filters.minEngagement != null) {
      accountQuery = accountQuery.gte("engagement_rate", filters.minEngagement);
    }
    if (filters.minViews != null) {
      // Phase 0: NULL avg_views never matches an active minimum.
      accountQuery = accountQuery.gte("avg_views", filters.minViews);
    }

    const { data, error } = await accountQuery;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = row.influencer_id as string | null;
      if (id) qualified.add(id);
    }
  }

  return qualified;
}

async function fetchCountryQualifiedInfluencerIdSet(
  supabase: SupabaseClient,
  countryCodes: string[],
  candidateIds: string[]
): Promise<Set<string>> {
  const qualified = new Set<string>();
  if (candidateIds.length === 0 || countryCodes.length === 0) return qualified;

  for (const chunk of chunkValues(candidateIds, IN_FILTER_BATCH_SIZE)) {
    let query = supabase.from("influencers").select("id").in("id", chunk);
    query = applyInfluencerCountriesBrowseFilter(query, countryCodes);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = (row as { id?: string }).id;
      if (id) qualified.add(id);
    }
  }

  return qualified;
}

/**
 * Qualify an ordered candidate ID list before hydration.
 * Returns the same order with non-matching IDs removed.
 */
export async function qualifyBrowseCandidateIds(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  orderedCandidateIds: string[]
): Promise<string[]> {
  if (orderedCandidateIds.length === 0) return [];
  if (!browseCandidateQualificationActive(filters)) {
    return orderedCandidateIds;
  }

  const platforms = resolveBrowsePlatformKeys(filters);
  const countries = resolveBrowseCreatorCountryCodes(filters);
  const needsAccount = browseAccountQualificationActive(filters);
  const needsCountry = countries.length > 0;

  const [accountQualified, countryQualified] = await Promise.all([
    needsAccount
      ? fetchAccountQualifiedInfluencerIdSet(
          supabase,
          filters,
          platforms,
          orderedCandidateIds
        )
      : Promise.resolve(null),
    needsCountry
      ? fetchCountryQualifiedInfluencerIdSet(
          supabase,
          countries,
          orderedCandidateIds
        )
      : Promise.resolve(null),
  ]);

  return orderedCandidateIds.filter((id) => {
    if (accountQualified && !accountQualified.has(id)) return false;
    if (countryQualified && !countryQualified.has(id)) return false;
    return true;
  });
}
