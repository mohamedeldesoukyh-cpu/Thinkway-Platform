/**
 * Creator Intelligence coverage — how much of the creator pool has resolved
 * intelligence per attribute. This is the metric that gates migration cutover
 * AND the signal acquisition should use: acquire only when INTELLIGENT supply
 * is insufficient, not when a raw column happens to be empty.
 */
import type { CreatorIntelligence } from "./types";

export type AttributeCoverage = {
  resolved: number;
  total: number;
  /** 0..100 */
  coverage: number;
};

export type IntelligenceCoverageReport = {
  total: number;
  categories: AttributeCoverage;
  niche: AttributeCoverage;
  topics: AttributeCoverage;
  languages: AttributeCoverage;
  audienceCountry: AttributeCoverage;
  brandSafety: AttributeCoverage;
  byPlatform: Record<string, AttributeCoverage>;
};

function coverageOf(resolved: number, total: number): AttributeCoverage {
  return {
    resolved,
    total,
    coverage: total === 0 ? 0 : Math.round((resolved / total) * 100),
  };
}

/** Evaluate attribute coverage across a resolved creator pool. */
export function evaluateIntelligenceCoverage(
  profiles: ReadonlyArray<CreatorIntelligence>
): IntelligenceCoverageReport {
  const total = profiles.length;
  let categories = 0;
  let niche = 0;
  let topics = 0;
  let languages = 0;
  let audienceCountry = 0;
  let brandSafety = 0;
  const platformTotals = new Map<string, { resolved: number; total: number }>();

  for (const profile of profiles) {
    const hasCategories = profile.categories.value.length > 0;
    if (hasCategories) categories += 1;
    if (profile.niche.value) niche += 1;
    if (profile.topics.value.length > 0) topics += 1;
    if (profile.languages.value.length > 0) languages += 1;
    if (profile.audience.primaryCountry.value) audienceCountry += 1;
    if (profile.brandSafety.level.value !== "unknown") brandSafety += 1;

    for (const platform of profile.platforms) {
      const entry = platformTotals.get(platform) ?? { resolved: 0, total: 0 };
      entry.total += 1;
      if (hasCategories) entry.resolved += 1;
      platformTotals.set(platform, entry);
    }
  }

  return {
    total,
    categories: coverageOf(categories, total),
    niche: coverageOf(niche, total),
    topics: coverageOf(topics, total),
    languages: coverageOf(languages, total),
    audienceCountry: coverageOf(audienceCountry, total),
    brandSafety: coverageOf(brandSafety, total),
    byPlatform: Object.fromEntries(
      [...platformTotals.entries()].map(([platform, entry]) => [
        platform,
        coverageOf(entry.resolved, entry.total),
      ])
    ),
  };
}
