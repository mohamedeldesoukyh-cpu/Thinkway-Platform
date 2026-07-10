import type { SupabaseClient } from "@supabase/supabase-js";

import { browseUnifiedCreatorsWithCoverageBackfill } from "@/lib/discovery/coverage-backfill-orchestrator";
import { rerankCreatorsByCampaignFit } from "@/lib/discovery/campaign-fit-rerank";
import { rankBrowseCreatorsForCampaign } from "@/lib/discovery/rank-browse-for-campaign";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import { searchTrace } from "@/lib/creators/search-trace";

import { getCampaignIntelligenceProfileById } from "../services/profile-repository";
import {
  discoveryMappedFiltersToBrowseFilters,
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

  const result = await browseUnifiedCreatorsWithCoverageBackfill(
    supabase,
    browseFilters,
    "ai"
  );

  const preferredPlatforms = [
    ...mappedFilters.filter((f) => f.key === "platform").map((f) => f.value),
    ...(profile.platforms ?? []),
  ];

  const rankedCreators = rankBrowseCreatorsForCampaign(
    result.creators,
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
      browseCount: result.creators.length,
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
    total: result.total,
    backfill: result.backfill,
    slate: slate.meta,
  };
}
