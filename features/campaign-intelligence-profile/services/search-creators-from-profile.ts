import type { SupabaseClient } from "@supabase/supabase-js";

import { browseUnifiedCreatorsWithCoverageBackfill } from "@/lib/discovery/coverage-backfill-orchestrator";
import { rerankCreatorsByCampaignFit } from "@/lib/discovery/campaign-fit-rerank";
import { rankBrowseCreatorsForCampaign } from "@/lib/discovery/rank-browse-for-campaign";
import { mergeAiCandidatePools } from "@/lib/discovery/ai-candidate-pool";
import { applyEnterpriseConstraints } from "@/lib/discovery/enterprise-constraint-engine";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import { searchTrace } from "@/lib/creators/search-trace";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { filtersToRelaxedBrowseParams } from "@/features/discovery/components/creator-search/creator-search-types";

import { getCampaignIntelligenceProfileById } from "../services/profile-repository";
import {
  discoveryMappedFiltersToBrowseFilters,
  discoveryMappedFiltersToCreatorFilters,
  mapCampaignIntelligenceToDiscoverySearch,
} from "../services/discovery-search-mapping";
import { hasValidatedIntelligence } from "../services/get-validated-intelligence";
import { normalizeCampaignIntelligenceProfile } from "../services/normalize-profile";
import type { CampaignIntelligenceProfile } from "../types/profile";

import { mapBrowseCreatorToSearchResult } from "@/features/campaign-studio/services/creator-platform-utils";
import {
  buildCreatorContentIdea,
  composeCreatorSlate,
  sanitizePreferredCategories,
} from "@/features/campaign-studio/services/creator-slate";
import { deriveCreatorCategoriesFromBrief } from "@/features/campaign-studio/services/derive-creator-categories";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import { getIndustryCreatorMix } from "@/features/campaign-studio/services/presentation-intelligence";

/** Studio + tools — search creators from CIP with coverage backfill + re-browse. */
export async function searchCreatorsFromCampaignIntelligenceProfile(
  supabase: SupabaseClient,
  profileId: string,
  pageSize = 50
) {
  const row = await getCampaignIntelligenceProfileById(supabase, profileId);
  if (!row) {
    throw new Error("Campaign intelligence profile not found.");
  }

  const profile = normalizeCampaignIntelligenceProfile(row.profile);
  if (!hasValidatedIntelligence(profile)) {
    throw new Error("Campaign intelligence profile is not ready for discovery search.");
  }

  return searchCreatorsFromProfileData(supabase, profile, profileId, pageSize);
}

/**
 * Prefer category/geo SQL filters over inferred product FTS tokens (e.g. "5G").
 * Content keywords remain in coverageIntent for soft ranking / acquisition.
 * Without this, telecom enrichment collapses Egypt category browse to rare
 * FTS hits that then fail audience/hydration and yield an empty Studio slate.
 */
export function preferCategoryBrowseOverKeywordSearch<
  T extends { search?: string; categories?: string[] },
>(filters: T): T {
  if ((filters.categories?.length ?? 0) === 0) return filters;
  if (!filters.search?.trim()) return filters;
  return { ...filters, search: undefined };
}

export async function searchCreatorsFromProfileData(
  supabase: SupabaseClient,
  profile: CampaignIntelligenceProfile,
  profileId: string,
  pageSize = 50
) {
  const { filters: mappedFilters } = mapCampaignIntelligenceToDiscoverySearch(profile);
  const browseFilters = preferCategoryBrowseOverKeywordSearch({
    ...discoveryMappedFiltersToBrowseFilters(mappedFilters, 1, pageSize),
    campaignIntelligenceProfileId: profileId,
  });

  searchTrace("cip_search_filters", { profileId, browseFilters }, { path: "ai" });

  // Strict pool: the brief's real filters in SQL — guarantees on-brief creators
  // enter the pool and drives coverage evaluation / acquisition backfill.
  const result = await browseUnifiedCreatorsWithCoverageBackfill(
    supabase,
    browseFilters,
    "ai"
  );

  // Relaxed pool: platform-only SQL — the same dual-pool sourcing Discovery AI
  // mode uses (creator-search-workspace). Brief signals are scored as soft
  // criteria by the relevance ranker below instead of excluding creators in
  // SQL. Without this pool, a brief whose strict AND-filters match nothing in
  // the database yields an empty slate even though rankable creators exist.
  let relaxedCreators: UnifiedCreatorResult[] = [];
  const creatorFilters = discoveryMappedFiltersToCreatorFilters(mappedFilters);
  try {
    // Platform-relaxed pool must still honor mandatory geography. Otherwise the
    // first global page can contain zero on-market creators and the Enterprise
    // Constraint Engine correctly empties the slate (seen on beauty briefs).
    const relaxed = await browseUnifiedCreators(
      supabase,
      {
        ...filtersToRelaxedBrowseParams(creatorFilters, 1, pageSize),
        country: creatorFilters.countries[0]?.trim().toUpperCase() || undefined,
        creatorCountries:
          creatorFilters.countries.length > 0 ? creatorFilters.countries : undefined,
        campaignIntelligenceProfileId: profileId,
        skipCoverageBackfill: true,
      },
      "ai"
    );
    relaxedCreators = relaxed.creators;
  } catch (error) {
    searchTrace(
      "cip_search_relaxed_pool_error",
      {
        profileId,
        message: error instanceof Error ? error.message : String(error),
      },
      { path: "ai" }
    );
  }

  let pooled = mergeAiCandidatePools(result.creators, relaxedCreators);

  // When keyword/age AND-filters empty the strict pool and the relaxed pool
  // times out (Prod authenticator statement_timeout), recover with category +
  // market + platform browse so Studio still gets a boardroom slate.
  if (pooled.length === 0) {
    try {
      const fallback = await browseUnifiedCreators(
        supabase,
        {
          country: creatorFilters.countries[0]?.trim().toUpperCase() || undefined,
          creatorCountries:
            creatorFilters.countries.length > 0 ? creatorFilters.countries : undefined,
          categories:
            creatorFilters.categories.length > 0 ? creatorFilters.categories : undefined,
          platforms:
            creatorFilters.platforms.length > 1 ? creatorFilters.platforms : undefined,
          platform:
            creatorFilters.platforms.length === 1
              ? creatorFilters.platforms[0]
              : undefined,
          productionOnly: true as const,
          page: 1,
          pageSize,
          campaignIntelligenceProfileId: profileId,
          skipCoverageBackfill: true,
        },
        "ai"
      );
      pooled = mergeAiCandidatePools([], fallback.creators);
      searchTrace(
        "cip_search_empty_pool_fallback",
        {
          profileId,
          fallbackCount: fallback.creators.length,
          pooledCount: pooled.length,
        },
        { path: "ai" }
      );
    } catch (error) {
      searchTrace(
        "cip_search_empty_pool_fallback_error",
        {
          profileId,
          message: error instanceof Error ? error.message : String(error),
        },
        { path: "ai" }
      );
    }
  }

  // Enterprise Constraint Engine — mandatory constraints never relax.
  // Relaxed pool may fetch platform-wide creators for coverage, but violators
  // of country / platform / language / brand safety are removed before ranking.
  const constrained = applyEnterpriseConstraints(pooled, mappedFilters);
  const pool = constrained.creators;

  searchTrace(
    "cip_search_candidate_pool",
    {
      profileId,
      strictCount: result.creators.length,
      relaxedCount: relaxedCreators.length,
      pooledCount: pooled.length,
      mandatoryCompliantCount: pool.length,
      rejectedMandatoryCount: constrained.rejectedMandatoryCount,
      preferredRelaxations: constrained.relaxations.map((r) => ({
        key: r.key,
        value: r.value,
        reason: r.reason,
      })),
    },
    { path: "ai" }
  );

  const preferredPlatforms = [
    ...mappedFilters.filter((f) => f.key === "platform").map((f) => f.value),
    ...(profile.platforms ?? []),
  ];

  const rankedCreators = rankBrowseCreatorsForCampaign(
    pool,
    profile,
    mappedFilters
  );

  let rerankedCreators = rankedCreators;
  let rerankMeta: Awaited<ReturnType<typeof rerankCreatorsByCampaignFit>>["rerank"] = {
    creatorIds: rankedCreators.map((c) => c.unified_id),
    fitScores: Object.fromEntries(
      rankedCreators.map((c) => [c.unified_id, c.campaign_relevance_score ?? 0])
    ),
    usedLlm: false,
  };

  try {
    const rerankResult = await rerankCreatorsByCampaignFit(rankedCreators, profile);
    rerankedCreators = rerankResult.creators;
    rerankMeta = rerankResult.rerank;
  } catch (error) {
    searchTrace(
      "cip_search_rerank_error",
      {
        profileId,
        message: error instanceof Error ? error.message : String(error),
      },
      { path: "ai" }
    );
  }

  searchTrace(
    "cip_search_relevance_ranked",
    {
      profileId,
      browseCount: pool.length,
      usedLlmRerank: rerankMeta.usedLlm,
      rerankError: rerankMeta.error ?? null,
      topScores: rerankedCreators.slice(0, 5).map((c) => ({
        id: c.unified_id,
        score: c.campaign_relevance_score ?? null,
      })),
    },
    { path: "ai" }
  );

  const mappedCreators = rerankedCreators.map((creator) =>
    mapBrowseCreatorToSearchResult(creator, preferredPlatforms)
  );

  const { items: dedupedCreators } = dedupeByCreatorId(mappedCreators, (c) => c.id);

  // Strategy coherence: recommendations must execute the strategy — explicit
  // brief platforms are a hard constraint and the slate tracks the industry
  // tier mix (the same mix the strategy document uses).
  const industry = detectIndustryFromBrief(
    profile.industry,
    profile.rawBriefExcerpt,
    profile.objective
  );
  const briefContext = [profile.rawBriefExcerpt, profile.objective, profile.audience]
    .filter(Boolean)
    .join("\n");
  const tierMix = getIndustryCreatorMix(industry, briefContext).map((t) => ({
    tier: t.tier,
    percent: t.percent,
  }));
  const preferredCategories = sanitizePreferredCategories(
    deriveCreatorCategoriesFromBrief({
      briefText: profile.rawBriefExcerpt,
      objective: profile.objective ?? profile.objectives?.join(" "),
      audience: profile.audience,
      campaignName: profile.campaignName,
      products: profile.products,
      existingCategories: [
        ...mappedFilters.filter((f) => f.key === "category").map((f) => f.value),
        ...(profile.creatorCategories ?? []),
      ],
    })
  );
  const slate = composeCreatorSlate(dedupedCreators, {
    platforms: preferredPlatforms,
    tierMix,
    preferredCategories,
    /** Cap consulting slate size so tier mix stays decisive on a boardroom shortlist. */
    targetCount:
      dedupedCreators.length > 0 ? Math.min(10, dedupedCreators.length) : undefined,
    /** Platform is a mandatory enterprise constraint — never fall back to off-platform. */
    strictPlatform: preferredPlatforms.length > 0,
  });
  const factsLite = {
    objective: profile.objective ?? profile.objectives?.join(" "),
    rawBriefExcerpt: profile.rawBriefExcerpt,
  };
  const poolCreators = dedupedCreators.map((creator, index) => ({
    ...creator,
    contentIdea:
      creator.contentIdea ?? buildCreatorContentIdea(creator, factsLite, index),
  }));

  searchTrace(
    "cip_search_slate_composition",
    {
      profileId,
      industry,
      preferredCategories: slate.meta.preferredCategories,
      categoryFallback: slate.meta.categoryFallback,
      offCategoryPadCount: slate.meta.offCategoryPadCount,
      requestedMix: slate.meta.requestedMix,
      achievedMix: slate.meta.achievedMix,
      platformFiltered: slate.meta.platformFiltered,
      platformFallback: slate.meta.platformFallback,
    },
    { path: "ai" }
  );

  const categoryRelaxation =
    slate.meta.categoryFallback && preferredCategories.length > 0
      ? [
          {
            key: "category",
            value: preferredCategories.join(", "),
            label: preferredCategories
              .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
              .join(", "),
            reason:
              slate.meta.categoryFallbackReason ??
              "Preferred category inventory was thin — adjacent creators added.",
            businessImpact:
              "Category adjacency may dilute brief fit; mandatory country/platform gates still apply.",
          },
        ]
      : [];

  return {
    creators: poolCreators,
    // Ranked mandatory-compliant inventory — Studio displays this pool.
    // composeCreatorSlate still runs for mix/meta; it must not hide the pool.
    total: pool.length,
    backfill: result.backfill,
    slate: slate.meta,
    constraintReport: {
      mandatory: constrained.mandatory.map((c) => ({
        key: c.key,
        value: c.value,
        label: c.label,
      })),
      rejectedMandatoryCount: constrained.rejectedMandatoryCount,
      relaxations: [...constrained.relaxations, ...categoryRelaxation],
    },
  };
}
