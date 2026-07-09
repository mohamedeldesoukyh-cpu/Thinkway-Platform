import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";
import {
  discoveryMappedFiltersToCriteria,
  type DiscoveryMappedFilter,
} from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

import { rankCreatorsByCampaignRelevance } from "./campaign-relevance-scoring";

/** Supplement mapped Discovery criteria with campaign objectives as soft keyword signals. */
export function buildCampaignSearchCriteria(
  profile: CampaignIntelligenceProfile,
  mappedFilters: DiscoveryMappedFilter[]
): CampaignSearchCriterion[] {
  const criteria = discoveryMappedFiltersToCriteria(mappedFilters);
  const seen = new Set(
    criteria.map((c) => `${c.meta?.discoveryKey ?? c.kind}:${c.value.trim().toLowerCase()}`)
  );

  for (const objective of profile.objectives ?? []) {
    const value = objective.trim();
    if (value.length < 3) continue;
    const key = `content_keyword:${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    criteria.push({
      id: `objective-${criteria.length}`,
      kind: "niche",
      label: "Campaign objective",
      value,
      weight: 50,
      enabled: true,
      meta: { discoveryKey: "content_keyword", rawValue: value },
    });
  }

  return criteria;
}

/** Rank unified browse rows by campaign relevance — same scoring as Discovery AI mode. */
export function rankBrowseCreatorsForCampaign(
  creators: UnifiedCreatorResult[],
  profile: CampaignIntelligenceProfile,
  mappedFilters: DiscoveryMappedFilter[]
): UnifiedCreatorResult[] {
  const criteria = buildCampaignSearchCriteria(profile, mappedFilters);
  const hasEnabledCriteria = criteria.some((c) => c.enabled && c.value.trim());
  if (!hasEnabledCriteria) return creators;
  return rankCreatorsByCampaignRelevance(creators, criteria);
}
