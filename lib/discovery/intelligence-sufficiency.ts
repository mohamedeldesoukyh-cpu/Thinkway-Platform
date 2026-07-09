/**
 * Sprint 3 — Intelligence Sufficiency Check.
 * Replaces creator-count-only coverage as the backfill gate when dataset acquisition is enabled.
 */

import type { DiscoveryCoverageIntent } from "@/lib/creators/discovery-coverage";
import { buildGeoTargetedAcquisitionSeedsFromIntent } from "@/lib/discovery/acquisition-targeting";
import { evaluateDiscoveryCoverage, getDiscoveryCoverageConfig, type DiscoveryCoverageEvaluation } from "@/lib/creators/discovery-coverage";
import type {
  UnifiedCreatorBrowseResult,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import type { DiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-types";
import { getCachedDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";

export type IntelligenceGap =
  | "low_creator_count"
  | "low_dna_completeness"
  | "missing_brand_fit"
  | "missing_audience"
  | "missing_ai_category"
  | "missing_bio"
  | "stale_data";

export type IntelligenceSufficiencyLevel = "sufficient" | "partial" | "insufficient";

export type IntelligenceSufficiencyConfig = {
  minCreatorCount: number;
  minAvgDnaCompleteness: number;
  minBrandFitRatio: number;
  minAudienceRatio: number;
  minAiCategoryRatio: number;
  minBioRatio: number;
  minFreshnessRatio: number;
  scoreThreshold: number;
};

export type IntelligenceSufficiencyBreakdown = {
  matchingCreatorCount: number;
  averageDnaCompleteness: number;
  brandFitAvailabilityRatio: number;
  audienceAvailabilityRatio: number;
  aiCategoryCoverageRatio: number;
  bioAvailabilityRatio: number;
  freshnessRatio: number;
};

export type IntelligenceSufficiencyEvaluation = {
  sufficient: boolean;
  sufficiencyScore: number;
  sufficiencyLevel: IntelligenceSufficiencyLevel;
  intelligenceGaps: IntelligenceGap[];
  gapReasons: string[];
  breakdown: IntelligenceSufficiencyBreakdown;
  /** Legacy coverage retained for audit / staging comparison. */
  coverage: DiscoveryCoverageEvaluation;
  acquisitionRequired: boolean;
  /** Hints for targeting Apify search to fill gaps. */
  acquisitionHints: {
    prioritizeIntelligenceEnrichment: boolean;
    broadenCreatorDiscovery: boolean;
    refreshStaleProfiles: boolean;
    seedHashtag?: string;
    seedCategory?: string;
    seedAudience?: string;
    seedCountry?: string;
    seedLocationQuery?: string;
    fallbackHashtags?: string[];
  };
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getIntelligenceSufficiencyConfig(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): IntelligenceSufficiencyConfig {
  const coverageConfig = getDiscoveryCoverageConfig(settings);
  return {
    minCreatorCount: envNumber("INTELLIGENCE_MIN_CREATOR_COUNT", coverageConfig.minCount),
    minAvgDnaCompleteness: envNumber("INTELLIGENCE_MIN_AVG_DNA_COMPLETENESS", 35),
    minBrandFitRatio: envNumber("INTELLIGENCE_MIN_BRAND_FIT_RATIO", 0.25),
    minAudienceRatio: envNumber("INTELLIGENCE_MIN_AUDIENCE_RATIO", 0.4),
    minAiCategoryRatio: envNumber("INTELLIGENCE_MIN_AI_CATEGORY_RATIO", 0.3),
    minBioRatio: envNumber("INTELLIGENCE_MIN_BIO_RATIO", 0.5),
    minFreshnessRatio: envNumber("INTELLIGENCE_MIN_FRESHNESS_RATIO", 0.45),
    scoreThreshold: envNumber("INTELLIGENCE_SUFFICIENCY_THRESHOLD", settings.coverageThreshold),
  };
}

function ratio(matches: number, total: number): number {
  if (total === 0) return 0;
  return matches / total;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function hasBrandFit(creator: UnifiedCreatorResult): boolean {
  return creator.brand_fit_score != null && creator.brand_fit_score > 0;
}

function hasAudienceSignal(creator: UnifiedCreatorResult): boolean {
  if ((creator.audience_interests?.length ?? 0) > 0) return true;
  if (creator.audience_demographics && creator.audience_demographics.source !== "unavailable") {
    return true;
  }
  if (creator.country_code?.trim() || creator.estimated_country?.trim()) return true;
  return creator.platforms.some((p) => Boolean(p.audience_country?.trim()));
}

function hasAiCategory(creator: UnifiedCreatorResult): boolean {
  return Boolean(creator.ai_category?.trim() || creator.ai_niche?.trim());
}

function hasBio(creator: UnifiedCreatorResult): boolean {
  return Boolean(creator.bio?.trim());
}

function isFreshCreator(
  creator: UnifiedCreatorResult,
  maxAgeDays: number | null | undefined
): boolean {
  if (creator.enrichment_status === "enriched" || creator.enrichment_status === "partial") {
    if (!creator.last_enriched_at) return true;
    if (maxAgeDays == null) return true;
    const enrichedAt = Date.parse(creator.last_enriched_at);
    if (Number.isNaN(enrichedAt)) return false;
    const ageDays = Math.floor((Date.now() - enrichedAt) / (1000 * 60 * 60 * 24));
    return ageDays <= maxAgeDays;
  }
  return false;
}

function resolveSufficiencyLevel(score: number): IntelligenceSufficiencyLevel {
  if (score >= 80) return "sufficient";
  if (score >= 50) return "partial";
  return "insufficient";
}

function weightedIntelligenceScore(parts: Array<{ weight: number; value: number }>): number {
  let totalWeight = 0;
  let sum = 0;
  for (const part of parts) {
    totalWeight += part.weight;
    sum += part.weight * Math.max(0, Math.min(100, part.value));
  }
  if (totalWeight === 0) return 0;
  return Math.round(sum / totalWeight);
}

function resolveAcquisitionHints(
  intent: DiscoveryCoverageIntent,
  gaps: IntelligenceGap[]
): IntelligenceSufficiencyEvaluation["acquisitionHints"] {
  const broadenCreatorDiscovery = gaps.includes("low_creator_count");
  const prioritizeIntelligenceEnrichment =
    gaps.includes("low_dna_completeness") ||
    gaps.includes("missing_brand_fit") ||
    gaps.includes("missing_ai_category") ||
    gaps.includes("missing_bio") ||
    gaps.includes("missing_audience");
  const refreshStaleProfiles = gaps.includes("stale_data");

  const geoSeeds = buildGeoTargetedAcquisitionSeedsFromIntent(intent);
  const seedCategory = intent.categories?.[0]?.trim();
  const seedAudience = intent.audience?.trim();

  return {
    prioritizeIntelligenceEnrichment,
    broadenCreatorDiscovery,
    refreshStaleProfiles,
    seedHashtag: geoSeeds.primaryHashtag,
    seedCategory,
    seedAudience,
    seedCountry: geoSeeds.locationCountry ?? intent.country?.trim().toUpperCase(),
    seedLocationQuery: geoSeeds.primaryHashtag,
    fallbackHashtags: geoSeeds.fallbackHashtags,
  };
}

export function evaluateIntelligenceSufficiency(
  result: Pick<UnifiedCreatorBrowseResult, "creators" | "total">,
  intent: DiscoveryCoverageIntent = {},
  config: IntelligenceSufficiencyConfig = getIntelligenceSufficiencyConfig(),
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): IntelligenceSufficiencyEvaluation {
  const creators = result.creators;
  const count = creators.length;
  const coverage = evaluateDiscoveryCoverage(result, intent, getDiscoveryCoverageConfig(settings));

  const dnaValues = creators.map((c) => c.dna_completeness ?? 0);
  const averageDnaCompleteness = Math.round(average(dnaValues));

  const brandFitAvailabilityRatio = ratio(
    creators.filter(hasBrandFit).length,
    count
  );
  const audienceAvailabilityRatio = ratio(
    creators.filter(hasAudienceSignal).length,
    count
  );
  const aiCategoryCoverageRatio = ratio(creators.filter(hasAiCategory).length, count);
  const bioAvailabilityRatio = ratio(creators.filter(hasBio).length, count);
  const freshnessRatio = ratio(
    creators.filter((c) => isFreshCreator(c, settings.dataFreshnessDays)).length,
    count
  );

  const intelligenceGaps: IntelligenceGap[] = [];
  const gapReasons: string[] = [];

  if (count < config.minCreatorCount) {
    intelligenceGaps.push("low_creator_count");
    gapReasons.push(
      `Matching creator count ${count} is below minimum ${config.minCreatorCount}.`
    );
  }

  if (count > 0 && averageDnaCompleteness < config.minAvgDnaCompleteness) {
    intelligenceGaps.push("low_dna_completeness");
    gapReasons.push(
      `Average DNA completeness ${averageDnaCompleteness}% is below ${config.minAvgDnaCompleteness}% target.`
    );
  }

  if (count > 0 && brandFitAvailabilityRatio < config.minBrandFitRatio) {
    intelligenceGaps.push("missing_brand_fit");
    gapReasons.push(
      `Brand fit available for ${Math.round(brandFitAvailabilityRatio * 100)}% of matches (target ${Math.round(config.minBrandFitRatio * 100)}%).`
    );
  }

  if (count > 0 && audienceAvailabilityRatio < config.minAudienceRatio) {
    intelligenceGaps.push("missing_audience");
    gapReasons.push(
      `Audience signals available for ${Math.round(audienceAvailabilityRatio * 100)}% of matches (target ${Math.round(config.minAudienceRatio * 100)}%).`
    );
  }

  if (count > 0 && aiCategoryCoverageRatio < config.minAiCategoryRatio) {
    intelligenceGaps.push("missing_ai_category");
    gapReasons.push(
      `AI category/niche available for ${Math.round(aiCategoryCoverageRatio * 100)}% of matches (target ${Math.round(config.minAiCategoryRatio * 100)}%).`
    );
  }

  if (count > 0 && bioAvailabilityRatio < config.minBioRatio) {
    intelligenceGaps.push("missing_bio");
    gapReasons.push(
      `Bio available for ${Math.round(bioAvailabilityRatio * 100)}% of matches (target ${Math.round(config.minBioRatio * 100)}%).`
    );
  }

  if (count > 0 && freshnessRatio < config.minFreshnessRatio) {
    intelligenceGaps.push("stale_data");
    gapReasons.push(
      `Fresh enrichment data for ${Math.round(freshnessRatio * 100)}% of matches (target ${Math.round(config.minFreshnessRatio * 100)}%).`
    );
  }

  const countScore = count === 0 ? 0 : Math.min(100, (count / config.minCreatorCount) * 100);

  const sufficiencyScore = weightedIntelligenceScore([
    { weight: 20, value: countScore },
    { weight: 20, value: averageDnaCompleteness },
    { weight: 15, value: brandFitAvailabilityRatio * 100 },
    { weight: 15, value: audienceAvailabilityRatio * 100 },
    { weight: 10, value: aiCategoryCoverageRatio * 100 },
    { weight: 10, value: bioAvailabilityRatio * 100 },
    { weight: 10, value: freshnessRatio * 100 },
  ]);

  let sufficiencyLevel = resolveSufficiencyLevel(sufficiencyScore);
  if (count === 0) {
    sufficiencyLevel = "insufficient";
  } else if (intelligenceGaps.length > 0 && sufficiencyScore < config.scoreThreshold) {
    sufficiencyLevel = "insufficient";
  } else if (intelligenceGaps.length > 0) {
    sufficiencyLevel = "partial";
  }

  const acquisitionRequired =
    count < config.minCreatorCount || sufficiencyLevel === "insufficient";

  const sufficient =
    count >= config.minCreatorCount && sufficiencyLevel !== "insufficient";

  return {
    sufficient,
    sufficiencyScore,
    sufficiencyLevel,
    intelligenceGaps,
    gapReasons,
    breakdown: {
      matchingCreatorCount: count,
      averageDnaCompleteness,
      brandFitAvailabilityRatio,
      audienceAvailabilityRatio,
      aiCategoryCoverageRatio,
      bioAvailabilityRatio,
      freshnessRatio,
    },
    coverage,
    acquisitionRequired,
    acquisitionHints: resolveAcquisitionHints(intent, intelligenceGaps),
  };
}

export function intelligenceSufficiencyMeetsThreshold(
  evaluation: IntelligenceSufficiencyEvaluation,
  config: IntelligenceSufficiencyConfig = getIntelligenceSufficiencyConfig()
): boolean {
  return (
    evaluation.sufficiencyLevel !== "insufficient" &&
    evaluation.breakdown.matchingCreatorCount >= config.minCreatorCount
  );
}
