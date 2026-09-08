/**
 * CSR → DiscoveryMappedFilter[] projection.
 *
 * Discovery's public interface is unchanged: it still consumes
 * DiscoveryMappedFilter[]. This projector only translates the CSR Layer 1
 * (`search`) fields that already have a key in DISCOVERY_SEARCH_FILTER_KEYS.
 *
 * Everything else — the whole strategic layer, plus exclusions, for which no
 * allowlist key exists — is reported in `skipped` and stays in CSR.
 *
 * Phase 1: the output is used for shadow comparison ONLY. It is never handed to
 * a live browse call.
 */

import type {
  DiscoveryMappedFilter,
  DiscoverySearchFilterKey,
} from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";

import type {
  CreatorRequirement,
  CreatorSearchRequirements,
} from "../../types/creator-search-requirements";

/** Same threshold the CIP mapper uses, so shadow diffs are like-for-like. */
export const CSR_MIN_FILTER_CONFIDENCE = 0.55;

const FILTER_LABELS: Record<DiscoverySearchFilterKey, string> = {
  creator_country: "Creator Country",
  creator_city: "Creator City",
  audience_country: "Audience Country",
  audience_city: "Audience City",
  creator_gender: "Creator Gender",
  creator_age_min: "Creator Age Min",
  creator_age_max: "Creator Age Max",
  audience_gender: "Audience Gender",
  audience_age_min: "Audience Age Min",
  audience_age_max: "Audience Age Max",
  language: "Language",
  category: "Category",
  niche: "Niche",
  platform: "Social Platform",
  follower_min: "Follower Min",
  follower_max: "Follower Max",
  engagement_min: "Engagement Min",
  engagement_max: "Engagement Max",
  content_keyword: "Keyword",
  content_tag: "Content Tag",
  verified: "Verified",
  brand_safety_min: "Brand Safety",
  brand_fit_min: "Brand Fit",
};

export type CsrProjectionResult = {
  filters: DiscoveryMappedFilter[];
  /** Requirement ids that became Discovery filters. */
  projected: string[];
  /** Requirement ids / groups that cannot be expressed as Discovery filters. */
  skipped: string[];
};

type Collector = {
  filters: DiscoveryMappedFilter[];
  projected: string[];
  skipped: string[];
  seen: Set<string>;
};

function push(collector: Collector, requirement: CreatorRequirement<unknown> | undefined): void {
  if (!requirement) return;
  const key = requirement.discoveryKey;
  if (!key) {
    collector.skipped.push(requirement.id);
    return;
  }
  if (requirement.confidence < CSR_MIN_FILTER_CONFIDENCE) {
    collector.skipped.push(`${requirement.id}:low_confidence`);
    return;
  }
  const value = String(requirement.value).trim();
  if (!value) {
    collector.skipped.push(`${requirement.id}:empty`);
    return;
  }
  const dedupeKey = `${key}:${value.toLowerCase()}`;
  if (collector.seen.has(dedupeKey)) return;
  collector.seen.add(dedupeKey);

  collector.filters.push({
    id: `csr:${dedupeKey}`,
    key,
    label: FILTER_LABELS[key],
    value,
    weight: requirement.weight,
    confidence: requirement.confidence,
  });
  collector.projected.push(requirement.id);
}

function pushAll(collector: Collector, requirements: CreatorRequirement<unknown>[]): void {
  for (const requirement of requirements) push(collector, requirement);
}

/**
 * Project the searchable layer of CSR onto the existing Discovery filter shape.
 * Deterministic ids (`csr:<key>:<value>`) keep shadow comparisons stable.
 */
export function creatorSearchRequirementsToMappedFilters(
  requirements: CreatorSearchRequirements
): CsrProjectionResult {
  const collector: Collector = { filters: [], projected: [], skipped: [], seen: new Set() };
  const { search, strategic } = requirements;

  pushAll(collector, search.platforms);
  pushAll(collector, search.audienceCountries);
  pushAll(collector, search.creatorCountries);
  pushAll(collector, search.cities);
  pushAll(collector, search.languages);
  pushAll(collector, search.primaryCategories);
  pushAll(collector, search.secondaryCategories);
  pushAll(collector, search.niches);
  pushAll(collector, search.contentTopics);
  push(collector, search.audienceGender);
  push(collector, search.audienceAgeMin);
  push(collector, search.audienceAgeMax);
  push(collector, search.followerFloor);
  push(collector, search.followerCeiling);
  push(collector, search.engagementFloor);

  if (search.brandSafety === "required") {
    const dedupeKey = "brand_safety_min:70";
    if (!collector.seen.has(dedupeKey)) {
      collector.seen.add(dedupeKey);
      collector.filters.push({
        id: `csr:${dedupeKey}`,
        key: "brand_safety_min",
        label: FILTER_LABELS.brand_safety_min,
        value: "70",
        weight: 90,
        confidence: 0.88,
      });
      collector.projected.push("brand_safety:required");
    }
  }

  // Negative constraints have no Discovery allowlist key today.
  if (
    search.exclusions.creatorIds.length > 0 ||
    search.exclusions.handles.length > 0 ||
    search.exclusions.categories.length > 0 ||
    search.exclusions.keywords.length > 0 ||
    search.exclusions.competitorBrands.length > 0
  ) {
    collector.skipped.push("search.exclusions:no_discovery_key");
  }

  // The strategic layer is intentionally never projected.
  if (strategic.objective) collector.skipped.push("strategic.objective:not_searchable");
  if (strategic.kpis.length > 0) collector.skipped.push("strategic.kpis:not_searchable");
  if (strategic.tierMix.length > 0) collector.skipped.push("strategic.tierMix:not_searchable");
  if (strategic.contentPillars.length > 0) {
    collector.skipped.push("strategic.contentPillars:not_searchable");
  }
  if (strategic.contentFormats.length > 0) {
    collector.skipped.push("strategic.contentFormats:not_searchable");
  }
  if (strategic.audienceInterests.length > 0) {
    collector.skipped.push("strategic.audienceInterests:not_searchable");
  }
  if (strategic.archetypes.length > 0) {
    collector.skipped.push("strategic.archetypes:not_searchable");
  }

  return {
    filters: collector.filters,
    projected: collector.projected,
    skipped: collector.skipped,
  };
}
