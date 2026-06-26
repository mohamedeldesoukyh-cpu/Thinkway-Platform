/**
 * Future-ready audience filters (spec §8).
 *
 * ADDITIVE by design: rather than rewriting the Phase 2.5 filter UI, this module
 * defines a typed audience-demographic filter + pure predicate that operate on
 * the new demographics schema. It can be wired into search ranking / Shortlist
 * AI Match incrementally.
 *
 * Sparse-data rule: when a creator has no demographic data, audience filters do
 * NOT exclude them (we never penalize missing data) — they simply do not score.
 */

import type { AudienceDemographics } from "./components/audience-demographics-section";

export type AgeGroupKey = "13_17" | "18_24" | "25_34" | "35_44" | "45_54" | "55_plus";
export type GenderKey = "male" | "female";

export type AudienceDemographicFilter = {
  /** ISO country code or name fragment the audience should over-index on. */
  audienceCountry?: string | null;
  /** Dominant age group the audience should skew toward. */
  ageGroup?: AgeGroupKey | null;
  /** Minimum share (0–100) of a gender in the audience. */
  genderMinShare?: { gender: GenderKey; min: number } | null;
};

export function hasAnyAudienceFilter(filter: AudienceDemographicFilter): boolean {
  return Boolean(filter.audienceCountry || filter.ageGroup || filter.genderMinShare);
}

function topCountryMatches(
  demographics: AudienceDemographics,
  needle: string
): boolean {
  const list = demographics.topCountries;
  if (!list || list.length === 0) return false;
  const q = needle.trim().toLowerCase();
  return list.some(
    (c) =>
      (c.code && c.code.toLowerCase() === q) ||
      (c.name && c.name.toLowerCase().includes(q))
  );
}

function dominantAgeGroup(demographics: AudienceDemographics): AgeGroupKey | null {
  const entries = Object.entries(demographics.age) as Array<[AgeGroupKey, number | null]>;
  let best: AgeGroupKey | null = null;
  let bestVal = -1;
  for (const [key, value] of entries) {
    if (value != null && value > bestVal) {
      bestVal = value;
      best = key;
    }
  }
  return best;
}

/**
 * Pure predicate. Returns true when the creator passes (or when there is no
 * demographic data to evaluate — sparse data never excludes).
 */
export function matchesAudienceFilter(
  demographics: AudienceDemographics,
  filter: AudienceDemographicFilter
): boolean {
  if (!hasAnyAudienceFilter(filter)) return true;
  if (demographics.source === "unavailable") return true; // sparse-data passthrough

  if (filter.audienceCountry && !topCountryMatches(demographics, filter.audienceCountry)) {
    return false;
  }
  if (filter.ageGroup && dominantAgeGroup(demographics) !== filter.ageGroup) {
    return false;
  }
  if (filter.genderMinShare) {
    const share = demographics.gender[filter.genderMinShare.gender];
    if (share == null || share < filter.genderMinShare.min) return false;
  }
  return true;
}

/**
 * 0–1 audience match score for Shortlist AI Match. Returns null when there is no
 * demographic data (so callers can fall back to other signals rather than
 * treating "no data" as a 0 match).
 */
export function scoreAudienceMatch(
  demographics: AudienceDemographics,
  filter: AudienceDemographicFilter
): number | null {
  if (!hasAnyAudienceFilter(filter)) return null;
  if (demographics.source === "unavailable") return null;

  const checks: boolean[] = [];
  if (filter.audienceCountry) {
    checks.push(topCountryMatches(demographics, filter.audienceCountry));
  }
  if (filter.ageGroup) {
    checks.push(dominantAgeGroup(demographics) === filter.ageGroup);
  }
  if (filter.genderMinShare) {
    const share = demographics.gender[filter.genderMinShare.gender];
    checks.push(share != null && share >= filter.genderMinShare.min);
  }
  if (checks.length === 0) return null;
  return checks.filter(Boolean).length / checks.length;
}

/**
 * Map the existing Phase 2.5 `CreatorSearchFilters` fields (audienceCountry,
 * gender, ageMin/ageMax) to a typed demographic filter WITHOUT modifying those
 * types. Lets the new predicate be wired in additively.
 */
export function audienceFilterFromSearchFields(fields: {
  audienceCountry?: string;
  gender?: string;
  ageMin?: string;
  ageMax?: string;
}): AudienceDemographicFilter {
  const ageGroup = ageGroupFromRange(fields.ageMin, fields.ageMax);
  const genderRaw = fields.gender?.trim().toLowerCase();
  const gender: GenderKey | null =
    genderRaw === "male" ? "male" : genderRaw === "female" ? "female" : null;

  return {
    audienceCountry: fields.audienceCountry?.trim() || null,
    ageGroup,
    genderMinShare: gender ? { gender, min: 50 } : null,
  };
}

function ageGroupFromRange(
  min: string | undefined,
  max: string | undefined
): AgeGroupKey | null {
  const lo = min ? Number(min) : NaN;
  const hi = max ? Number(max) : NaN;
  if (Number.isNaN(lo) && Number.isNaN(hi)) return null;
  const mid = Number.isNaN(lo)
    ? hi
    : Number.isNaN(hi)
      ? lo
      : (lo + hi) / 2;
  if (mid < 18) return "13_17";
  if (mid < 25) return "18_24";
  if (mid < 35) return "25_34";
  if (mid < 45) return "35_44";
  if (mid < 55) return "45_54";
  return "55_plus";
}
