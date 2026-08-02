import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  browseUnifiedCreators,
  coverageMeetsThreshold,
  evaluateDiscoveryCoverage,
  getDiscoveryCoverageConfig,
} from "@/lib/creators/unified-browse";
import { writeDiscoveryCoverageDecision } from "@/lib/creators/discovery-coverage-audit";
import type { DiscoveryCoverageEvaluation } from "@/lib/creators/discovery-coverage";
import { searchTrace } from "@/lib/creators/search-trace";
import { maybeTriggerCoverageBackfill } from "@/lib/discovery/coverage-backfill";
import { isDatasetAcquisitionBackfillEnabled } from "@/lib/discovery/dataset-acquisition-policy";
import {
  evaluateIntelligenceSufficiency,
  getIntelligenceSufficiencyConfig,
} from "@/lib/discovery/intelligence-sufficiency";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

import {
  type CampaignSearchIntent,
  expandCategoriesForIndustry,
  semanticKeywordsForIndustry,
} from "./campaign-search-intent";

export type ProgressiveSearchStageId =
  | "A_category_country"
  | "B_category_only"
  | "C_industry"
  | "D_semantic_keywords"
  | "E_broad";

export type ProgressiveSearchStageAttempt = {
  stage: ProgressiveSearchStageId;
  label: string;
  filters: UnifiedCreatorBrowseFilters;
  total: number;
  creatorCount: number;
  coverageScore: number;
  coverageLevel: DiscoveryCoverageEvaluation["coverageLevel"];
};

export type ProgressiveCreatorSearchResult = {
  searchId: string;
  intent: CampaignSearchIntent;
  stagesAttempted: ProgressiveSearchStageAttempt[];
  chosenStage: ProgressiveSearchStageId;
  browseResult: Awaited<ReturnType<typeof browseUnifiedCreators>>;
  coverage: DiscoveryCoverageEvaluation;
  apifyExecuted: boolean;
  apifyReason?: string;
};

export type ProgressiveCreatorSearchInput = {
  intent: CampaignSearchIntent;
  pageSize: number;
  productionOnly?: boolean;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  minThinkwayScore?: number;
  language?: string;
  explicitPlatforms?: string[];
  explicitCategories?: string[];
  explicitCountry?: string;
  searchId?: string;
};

const STAGE_LABELS: Record<ProgressiveSearchStageId, string> = {
  A_category_country: "Category + country",
  B_category_only: "Category only",
  C_industry: "Industry categories",
  D_semantic_keywords: "Semantic keywords",
  E_broad: "Broad search",
};

function resolvePlatforms(
  intent: CampaignSearchIntent,
  explicit?: string[]
): string[] {
  if (explicit?.length) return explicit;
  if (intent.platforms.length > 0) return intent.platforms;
  return [];
}

function resolveCategories(
  intent: CampaignSearchIntent,
  explicit?: string[]
): string[] {
  if (explicit?.length) return explicit;
  return expandCategoriesForIndustry(intent.industryKey, intent.categories);
}

function buildCoverageIntent(input: ProgressiveCreatorSearchInput) {
  return {
    country: input.explicitCountry ?? input.intent.country,
    categories: resolveCategories(input.intent, input.explicitCategories),
    platforms: resolvePlatforms(input.intent, input.explicitPlatforms),
    audience: input.intent.audience,
    minFollowers: input.minFollowers,
    maxFollowers: input.maxFollowers,
    searchConfidence: undefined,
  };
}

function buildBaseFilters(
  input: ProgressiveCreatorSearchInput
): Omit<UnifiedCreatorBrowseFilters, "search" | "country" | "categories"> {
  const platforms = resolvePlatforms(input.intent, input.explicitPlatforms);
  return {
    platform: platforms.length === 1 ? platforms[0] : undefined,
    platforms: platforms.length > 1 ? platforms : undefined,
    language: input.language ?? input.intent.language,
    minFollowers: input.minFollowers,
    maxFollowers: input.maxFollowers,
    minEngagement: input.minEngagement,
    minThinkwayScore: input.minThinkwayScore,
    productionOnly: input.productionOnly ?? true,
    pageSize: input.pageSize,
    page: 1,
    coverageIntent: buildCoverageIntent(input),
  };
}

function buildStageFilters(
  stage: ProgressiveSearchStageId,
  input: ProgressiveCreatorSearchInput
): UnifiedCreatorBrowseFilters {
  const base = buildBaseFilters(input);
  const categories = resolveCategories(input.intent, input.explicitCategories);
  const country = input.explicitCountry ?? input.intent.country;

  switch (stage) {
    case "A_category_country":
      return {
        ...base,
        categories: categories.length > 0 ? categories : undefined,
        country: country || undefined,
        search: undefined,
      };
    case "B_category_only":
      // Enterprise Constraint Engine: country remains mandatory when known.
      // Only preferred category breadth may widen — never drop country.
      return {
        ...base,
        categories: categories.length > 0 ? categories : undefined,
        country: country || undefined,
        search: undefined,
      };
    case "C_industry":
      return {
        ...base,
        categories: expandCategoriesForIndustry(input.intent.industryKey),
        country: country || undefined,
        search: input.intent.industry.split(/\s+/)[0]?.toLowerCase(),
      };
    case "D_semantic_keywords": {
      const keywords =
        input.intent.semanticKeywords.length > 0
          ? input.intent.semanticKeywords
          : semanticKeywordsForIndustry(input.intent.industryKey);
      return {
        ...base,
        search: keywords.slice(0, 5).join(" "),
        country: country || undefined,
      };
    }
    case "E_broad":
      return {
        ...base,
        country: country || undefined,
        search: undefined,
      };
    default:
      return base;
  }
}

const PROGRESSIVE_STAGE_ORDER: ProgressiveSearchStageId[] = [
  "A_category_country",
  "B_category_only",
  "C_industry",
  "D_semantic_keywords",
  "E_broad",
];

/**
 * Progressive creator search — ONE workflow search with internal fallback attempts.
 * Each stage calls browseUnifiedCreators(); stops when coverage score meets threshold.
 * Apify fallback runs ONLY when final coverage level is insufficient.
 */
export async function executeProgressiveCreatorSearch(
  supabase: SupabaseClient,
  input: ProgressiveCreatorSearchInput
): Promise<ProgressiveCreatorSearchResult> {
  const startedAt = Date.now();
  const searchId = input.searchId ?? randomUUID();
  const settings = await getDiscoveryControlSettings(supabase);
  const coverageConfig = getDiscoveryCoverageConfig(settings);
  const intelligenceConfig = getIntelligenceSufficiencyConfig(settings);
  const useIntelligenceGate = isDatasetAcquisitionBackfillEnabled();
  const coverageIntent = buildCoverageIntent(input);

  const stagesAttempted: ProgressiveSearchStageAttempt[] = [];
  let chosenStage: ProgressiveSearchStageId = "E_broad";
  let browseResult: Awaited<ReturnType<typeof browseUnifiedCreators>> | null = null;
  let coverage: DiscoveryCoverageEvaluation = evaluateDiscoveryCoverage(
    { creators: [], total: 0 },
    coverageIntent,
    coverageConfig
  );

  for (const stage of PROGRESSIVE_STAGE_ORDER) {
    const filters = buildStageFilters(stage, input);
    const result = await browseUnifiedCreators(supabase, filters, "ai");
    const stageCoverage =
      result.coverage ??
      evaluateDiscoveryCoverage(result, coverageIntent, coverageConfig);

    stagesAttempted.push({
      stage,
      label: STAGE_LABELS[stage],
      filters,
      total: result.total,
      creatorCount: result.creators.length,
      coverageScore: stageCoverage.coverageScore,
      coverageLevel: stageCoverage.coverageLevel,
    });

    searchTrace("ers2_progressive_stage", {
      stage,
      label: STAGE_LABELS[stage],
      total: result.total,
      creatorCount: result.creators.length,
      coverageScore: stageCoverage.coverageScore,
      coverageLevel: stageCoverage.coverageLevel,
      filters,
    }, { path: "ai" });

    browseResult = result;
    coverage = stageCoverage;
    chosenStage = stage;

    if (coverageMeetsThreshold(stageCoverage, coverageConfig)) {
      break;
    }
  }

  if (!browseResult) {
    const fallbackFilters = buildStageFilters("E_broad", input);
    browseResult = await browseUnifiedCreators(supabase, fallbackFilters, "ai");
    coverage =
      browseResult.coverage ??
      evaluateDiscoveryCoverage(browseResult, coverageIntent, coverageConfig);
    chosenStage = "E_broad";
  }

  let apifyExecuted = false;
  let apifyReason = "Apify fallback not required.";

  const intelligence = evaluateIntelligenceSufficiency(
    browseResult,
    coverageIntent,
    intelligenceConfig,
    settings
  );

  const shouldBackfill = useIntelligenceGate
    ? intelligence.acquisitionRequired
    : coverage.coverageLevel === "insufficient";

  if (shouldBackfill) {
    try {
      const backfill = await maybeTriggerCoverageBackfill(supabase, {
        searchId,
        intent: input.intent,
        coverage,
        intelligence,
        query: {
          progressiveStage: chosenStage,
          filters: stagesAttempted[stagesAttempted.length - 1]?.filters ?? {},
          intent: {
            industry: input.intent.industry,
            country: input.intent.country,
            categories: input.intent.categories,
            platforms: input.intent.platforms,
          },
        },
      });
      apifyExecuted =
        backfill.executed && (backfill.queued || (backfill.profilesAdded ?? 0) > 0);
      apifyReason = backfill.reason;
    } catch (error) {
      apifyReason =
        error instanceof Error
          ? `Coverage backfill failed: ${error.message}`
          : "Coverage backfill failed.";
      searchTrace("ers2_backfill_error", { message: apifyReason }, { path: "ai" });
    }
  } else {
    apifyReason = useIntelligenceGate
      ? `Skipped dataset acquisition — intelligence sufficiency is ${intelligence.sufficiencyLevel}.`
      : `Skipped Apify — coverage level ${coverage.coverageLevel}.`;
  }

  const durationMs = Date.now() - startedAt;
  const auditReason = apifyExecuted
    ? useIntelligenceGate
      ? "intelligence_insufficient_dataset_acquisition"
      : "db_insufficient_apify_enqueued"
    : shouldBackfill
      ? useIntelligenceGate
        ? "intelligence_insufficient_acquisition_skipped"
        : "db_insufficient_apify_skipped"
      : useIntelligenceGate
        ? "intelligence_sufficient"
        : "db_sufficient";

  try {
    await writeDiscoveryCoverageDecision(supabase, {
      searchId,
      searchQuery: {
        mode: "progressive",
        chosenStage,
        stagesAttempted: stagesAttempted.map((attempt) => ({
          stage: attempt.stage,
          total: attempt.total,
          coverageScore: attempt.coverageScore,
          coverageLevel: attempt.coverageLevel,
        })),
        intent: {
          industry: input.intent.industry,
          country: input.intent.country,
          categories: input.intent.categories,
          platforms: input.intent.platforms,
          audience: input.intent.audience,
        },
      },
      coverage,
      databaseCreatorsCount: browseResult.creators.length,
      apifyExecuted,
      reason: apifyReason || auditReason,
      durationMs,
    });
  } catch (error) {
    searchTrace(
      "ers2_audit_error",
      {
        message: error instanceof Error ? error.message : String(error),
      },
      { path: "ai" }
    );
  }

  searchTrace("ers2_progressive_chosen", {
    searchId,
    chosenStage,
    total: browseResult.total,
    creatorCount: browseResult.creators.length,
    coverageScore: coverage.coverageScore,
    coverageLevel: coverage.coverageLevel,
    apifyExecuted,
    apifyReason,
    stagesAttempted: stagesAttempted.map((attempt) => ({
      stage: attempt.stage,
      total: attempt.total,
      coverageScore: attempt.coverageScore,
    })),
  }, { path: "ai" });

  return {
    searchId,
    intent: input.intent,
    stagesAttempted,
    chosenStage,
    browseResult,
    coverage,
    apifyExecuted,
    apifyReason,
  };
}
