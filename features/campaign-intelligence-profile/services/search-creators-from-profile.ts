import type { SupabaseClient } from "@supabase/supabase-js";

import { browseUnifiedCreatorsWithCoverageBackfill } from "@/lib/discovery/coverage-backfill-orchestrator";
import { rerankCreatorsByCampaignFit } from "@/lib/discovery/campaign-fit-rerank";
import { rankBrowseCreatorsForCampaign } from "@/lib/discovery/rank-browse-for-campaign";
import { mergeAiCandidatePools } from "@/lib/discovery/ai-candidate-pool";
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
} from "@/features/campaign-studio/services/creator-slate";
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

export async function searchCreatorsFromProfileData(
  supabase: SupabaseClient,
  profile: CampaignIntelligenceProfile,
  profileId: string,
  pageSize = 50
) {
  const { filters: mappedFilters } = mapCampaignIntelligenceToDiscoverySearch(profile);
  const browseFilters = {
    ...discoveryMappedFiltersToBrowseFilters(mappedFilters, 1, pageSize),
    campaignIntelligenceProfileId: profileId,
  };

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
  try {
    const relaxed = await browseUnifiedCreators(
      supabase,
      {
        ...filtersToRelaxedBrowseParams(
          discoveryMappedFiltersToCreatorFilters(mappedFilters),
          1,
          pageSize
        ),
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

  const pool = mergeAiCandidatePools(result.creators, relaxedCreators);
  searchTrace(
    "cip_search_candidate_pool",
    {
      profileId,
      strictCount: result.creators.length,
      relaxedCount: relaxedCreators.length,
      pooledCount: pool.length,
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
  const tierMix = getIndustryCreatorMix(industry).map((t) => ({
    tier: t.tier,
    percent: t.percent,
  }));
  const slate = composeCreatorSlate(dedupedCreators, {
    platforms: preferredPlatforms,
    tierMix,
  });
  const factsLite = {
    objective: profile.objective ?? profile.objectives?.join(" "),
    rawBriefExcerpt: profile.rawBriefExcerpt,
  };
  const slateCreators = slate.creators.map((creator, index) => ({
    ...creator,
    contentIdea:
      creator.contentIdea ?? buildCreatorContentIdea(creator, factsLite, index),
  }));

  searchTrace(
    "cip_search_slate_composition",
    {
      profileId,
      industry,
      requestedMix: slate.meta.requestedMix,
      achievedMix: slate.meta.achievedMix,
      platformFiltered: slate.meta.platformFiltered,
      platformFallback: slate.meta.platformFallback,
    },
    { path: "ai" }
  );

  return {
    creators: slateCreators,
    // Strict total can be 0 while the relaxed pool still yields a rankable
    // slate — report the candidates actually available to the campaign.
    total: Math.max(result.total, pool.length),
    backfill: result.backfill,
    slate: slate.meta,
  };
}
