/**
 * CSR → live Discovery, additively.
 *
 * Phase 2 lets Creator Search Requirements influence the real creator search.
 * It does NOT replace the Campaign Intelligence Profile mapping that drives
 * Discovery today: the CIP filter set — including everything
 * `enrichBriefSearchSignals` infers from a thin brief — is load-bearing, and
 * CSR cannot reproduce it. So CSR filters are merged INTO the CIP set and the
 * CIP set always wins.
 *
 * Discovery's public interface is untouched: the output is still
 * `DiscoveryMappedFilter[]`, whose `key` is typed to the closed
 * `DISCOVERY_SEARCH_FILTER_KEYS` allowlist. Nothing outside that allowlist —
 * the whole CSR strategic layer, campaign budget included — can be expressed
 * here, so no commercial value can reach a SQL filter through this path.
 */

import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";

import type { CreatorSearchRequirements } from "../../types/creator-search-requirements";
import { creatorSearchRequirementsToMappedFilters } from "./creator-search-requirements-to-filters";
import type { ShadowFilterKey } from "./shadow-compare";

/**
 * Single-valued, AND-narrowing filter keys.
 *
 * `discoveryMappedFiltersToCreatorFilters` takes the FIRST value it sees for
 * each of these and ignores the rest, so a second entry is at best dead weight
 * and at worst a silent narrowing of the pool. CSR may fill one of these keys
 * only when the CIP set left it empty — it never adds a competing bound.
 */
const RANGE_KEYS: ReadonlySet<DiscoveryMappedFilter["key"]> = new Set([
  "creator_age_min",
  "creator_age_max",
  "audience_age_min",
  "audience_age_max",
  "follower_min",
  "follower_max",
  "engagement_min",
  "engagement_max",
  "brand_safety_min",
  "brand_fit_min",
  "creator_gender",
  "audience_gender",
  "verified",
]);

/**
 * Keys CSR must not contribute to LIVE Discovery, whatever it projects.
 *
 * `content_keyword` collapses downstream to a single `contentKeyword` FTS
 * scalar (`discoveryMappedFiltersToCreatorFilters` keeps the first and drops
 * the rest), and a keyword filter is the very thing
 * `preferCategoryBrowseOverKeywordSearch` exists to suppress, because FTS
 * tokens starve a category browse. Adding one where Discovery had none is a
 * behaviour change, not an addition.
 *
 * And CSR's only content-topic source beyond validated keywords — which the CIP
 * mapper already contributes — is Strategy pillar TITLES. The strategy document
 * available before search is the bootstrap Director-SSOT one, whose pillars are
 * structural sections ("Objective", "Audience", "Platform Mix", "Creator
 * Approach"). Those are not campaign content topics, and searching creator
 * content for them would degrade exactly the thin briefs that need help most.
 *
 * The topics stay in CSR, in `projected`, and in the shadow comparison — a
 * later phase can consume them as soft ranking signals, where they belong.
 */
const CSR_EXCLUDED_FROM_LIVE_SEARCH: ReadonlySet<DiscoveryMappedFilter["key"]> = new Set([
  "content_keyword",
]);

export type CsrFilterMergeResult = {
  /** CIP filters first, in their original order, then the CSR additions. */
  filters: DiscoveryMappedFilter[];
  /** Requirements CSR contributed that Discovery was not already asking for. */
  added: ShadowFilterKey[];
  /** Requirement ids the projector could not express, plus merge refusals. */
  skipped: string[];
};

/** Same identity `shadow-compare` uses, so the trace and the merge agree. */
function normalize(filter: DiscoveryMappedFilter): string {
  return `${filter.key}:${filter.value.trim().toLowerCase()}`;
}

/** True when CSR was built from information too thin to steer a live search. */
function hasBlockingGap(requirements: CreatorSearchRequirements): boolean {
  return requirements.gaps.some((gap) => gap.blocking);
}

/**
 * Merge the CSR projection into the live CIP filter set.
 *
 * The CIP set is returned unchanged — same filters, same objects, same order —
 * whenever CSR cannot contribute soundly: absent, empty projection, or built
 * over a blocking gap. That is the safe default, and it is what every existing
 * caller (which passes no CSR at all) gets.
 */
export function mergeCsrFiltersIntoDiscoveryFilters(input: {
  current: readonly DiscoveryMappedFilter[];
  requirements?: CreatorSearchRequirements | null;
}): CsrFilterMergeResult {
  const current = [...input.current];
  const requirements = input.requirements;

  if (!requirements) {
    return { filters: current, added: [], skipped: [] };
  }

  if (hasBlockingGap(requirements)) {
    return {
      filters: current,
      added: [],
      skipped: requirements.gaps
        .filter((gap) => gap.blocking)
        .map((gap) => `${gap.field}:blocking_gap`),
    };
  }

  const projection = creatorSearchRequirementsToMappedFilters(requirements);
  if (projection.filters.length === 0) {
    return { filters: current, added: [], skipped: projection.skipped };
  }

  const seen = new Set(current.map(normalize));
  const occupiedRangeKeys = new Set(
    current.filter((filter) => RANGE_KEYS.has(filter.key)).map((filter) => filter.key)
  );

  const filters = current;
  const added: ShadowFilterKey[] = [];
  const skipped = [...projection.skipped];

  for (const candidate of projection.filters) {
    const identity = normalize(candidate);

    if (CSR_EXCLUDED_FROM_LIVE_SEARCH.has(candidate.key)) {
      skipped.push(`${candidate.key}:not_projected_to_live_search`);
      continue;
    }

    // Discovery already asks for exactly this. The CIP filter keeps its id,
    // weight and confidence — CSR must never restate an existing requirement
    // with different provenance.
    if (seen.has(identity)) continue;

    if (RANGE_KEYS.has(candidate.key)) {
      if (occupiedRangeKeys.has(candidate.key)) {
        skipped.push(`${candidate.key}:range_key_already_set`);
        continue;
      }
      occupiedRangeKeys.add(candidate.key);
    }

    seen.add(identity);
    filters.push(candidate);
    added.push({ key: candidate.key, value: candidate.value });
  }

  return { filters, added, skipped };
}
