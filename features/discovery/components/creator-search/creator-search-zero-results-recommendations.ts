import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  CAMPAIGN_RELEVANCE_FALLBACK_TOP_N,
  describeMatchedCampaignCriteria,
  rankCreatorsByCampaignRelevance,
} from "@/lib/discovery/campaign-relevance-scoring";
import { dedupeCreatorsByPlatformHandle } from "@/lib/discovery/creator-result-dedupe";

import type { CreatorSearchRecommendation } from "./creator-search-recommended-section";
import {
  creatorSearchFiltersToCriteria,
  type CreatorSearchFilters,
} from "./creator-search-types";

/** Rank relaxed-pool creators against active manual filters for zero-results UX. */
export function buildCreatorSearchRecommendations(
  pool: UnifiedCreatorResult[],
  filters: CreatorSearchFilters,
  options?: { limit?: number }
): CreatorSearchRecommendation[] {
  const criteria = creatorSearchFiltersToCriteria(filters);
  if (criteria.length === 0) return [];

  const limit = options?.limit ?? CAMPAIGN_RELEVANCE_FALLBACK_TOP_N;
  const ranked = rankCreatorsByCampaignRelevance(pool, criteria);
  const deduped = dedupeCreatorsByPlatformHandle(ranked).slice(0, limit);

  return deduped.map((creator) => ({
    creator,
    relevanceScore: creator.campaign_relevance_score ?? 0,
    matchedAttributes: describeMatchedCampaignCriteria(creator, criteria),
  }));
}
