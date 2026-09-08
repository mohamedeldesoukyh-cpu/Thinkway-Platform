/**
 * Shadow comparison: current CIP filters vs hypothetical CSR filters.
 *
 * Phase 1 exists to prove what Strategy adds to creator search requirements
 * WITHOUT changing any live behaviour. This module computes the difference
 * between the filter set Discovery uses today (mapped from the Campaign
 * Intelligence Profile) and the filter set CSR would produce.
 *
 * It is read-only: it performs no search and mutates nothing.
 */

import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";

import type { CreatorSearchRequirements } from "../../types/creator-search-requirements";
import { creatorSearchRequirementsToMappedFilters } from "./creator-search-requirements-to-filters";

export type ShadowFilterKey = { key: string; value: string };

/** A campaign-intent requirement CSR carries that no Discovery filter can express. */
export type StrategicAddition = {
  field: string;
  detail: string;
};

export type CsrShadowComparison = {
  generatedAt: string;
  strategyRef?: CreatorSearchRequirements["strategyRef"];
  currentFilterCount: number;
  csrFilterCount: number;
  /** Present today, absent from CSR — a requirement CSR would drop. */
  onlyInCurrent: ShadowFilterKey[];
  /** Absent today, present in CSR — a requirement Strategy adds to search. */
  onlyInCsr: ShadowFilterKey[];
  shared: ShadowFilterKey[];
  /** Layer 2 intent CSR preserves that Discovery filters structurally cannot. */
  strategicAdditions: StrategicAddition[];
  /** Requirement ids the projector could not express. */
  skipped: string[];
  /** True when CSR would produce exactly today's filter set. */
  identicalFilters: boolean;
  blockingGaps: string[];
};

function normalize(filter: DiscoveryMappedFilter): string {
  return `${filter.key}:${filter.value.trim().toLowerCase()}`;
}

function toKey(filter: DiscoveryMappedFilter): ShadowFilterKey {
  return { key: filter.key, value: filter.value };
}

function sortKeys(items: ShadowFilterKey[]): ShadowFilterKey[] {
  return [...items].sort((a, b) =>
    a.key === b.key ? a.value.localeCompare(b.value) : a.key.localeCompare(b.key)
  );
}

/** Campaign intent CSR retains which has no Discovery filter equivalent. */
function collectStrategicAdditions(
  requirements: CreatorSearchRequirements
): StrategicAddition[] {
  const additions: StrategicAddition[] = [];
  const { strategic, search } = requirements;

  if (strategic.objective) {
    additions.push({
      field: "objective",
      detail: `${strategic.objective} (${strategic.objectiveKind})`,
    });
  }
  if (strategic.tierMix.length > 0) {
    additions.push({
      field: "tierMix",
      detail: strategic.tierMix.map((t) => `${t.tier} ${t.percent}%`).join(" · "),
    });
  }
  for (const kpi of strategic.kpis) {
    additions.push({ field: "kpi", detail: `${kpi.metric}: ${kpi.target}` });
  }
  for (const pillar of strategic.contentPillars) {
    additions.push({ field: "contentPillar", detail: pillar.title });
  }
  for (const format of strategic.contentFormats) {
    additions.push({ field: "contentFormat", detail: format.value });
  }
  for (const interest of strategic.audienceInterests) {
    additions.push({ field: "audienceInterest", detail: interest.value });
  }
  for (const archetype of strategic.archetypes) {
    additions.push({ field: "archetype", detail: archetype.value });
  }
  if (strategic.budget) {
    additions.push({
      field: "budget",
      detail: `${strategic.budget.amount} ${strategic.budget.currency}`,
    });
  }
  if (search.exclusions.keywords.length > 0) {
    additions.push({
      field: "exclusions",
      detail: search.exclusions.keywords.join(" · "),
    });
  }
  return additions;
}

/**
 * Compare the live CIP filter set against the CSR projection.
 * `currentFilters` is whatever mapCampaignIntelligenceToDiscoverySearch returned.
 */
export function compareCsrAgainstCurrentFilters(input: {
  currentFilters: readonly DiscoveryMappedFilter[];
  requirements: CreatorSearchRequirements;
  now?: string;
}): CsrShadowComparison {
  const projection = creatorSearchRequirementsToMappedFilters(input.requirements);

  const currentByKey = new Map(input.currentFilters.map((f) => [normalize(f), f]));
  const csrByKey = new Map(projection.filters.map((f) => [normalize(f), f]));

  const onlyInCurrent: ShadowFilterKey[] = [];
  const shared: ShadowFilterKey[] = [];
  for (const [key, filter] of currentByKey) {
    if (csrByKey.has(key)) shared.push(toKey(filter));
    else onlyInCurrent.push(toKey(filter));
  }

  const onlyInCsr: ShadowFilterKey[] = [];
  for (const [key, filter] of csrByKey) {
    if (!currentByKey.has(key)) onlyInCsr.push(toKey(filter));
  }

  return {
    generatedAt: input.now ?? new Date().toISOString(),
    ...(input.requirements.strategyRef ? { strategyRef: input.requirements.strategyRef } : {}),
    currentFilterCount: currentByKey.size,
    csrFilterCount: csrByKey.size,
    onlyInCurrent: sortKeys(onlyInCurrent),
    onlyInCsr: sortKeys(onlyInCsr),
    shared: sortKeys(shared),
    strategicAdditions: collectStrategicAdditions(input.requirements),
    skipped: projection.skipped,
    identicalFilters: onlyInCurrent.length === 0 && onlyInCsr.length === 0,
    blockingGaps: input.requirements.gaps
      .filter((gap) => gap.blocking)
      .map((gap) => `${gap.field}: ${gap.reason}`),
  };
}

/** One-line human summary for searchTrace / logs. */
export function formatShadowComparison(comparison: CsrShadowComparison): string {
  if (comparison.identicalFilters && comparison.strategicAdditions.length === 0) {
    return `CSR shadow: identical to current (${comparison.currentFilterCount} filters).`;
  }
  return [
    `CSR shadow: current=${comparison.currentFilterCount} csr=${comparison.csrFilterCount}`,
    `+${comparison.onlyInCsr.length} added`,
    `-${comparison.onlyInCurrent.length} dropped`,
    `${comparison.strategicAdditions.length} strategic signal(s) Discovery cannot express`,
  ].join(" · ");
}
