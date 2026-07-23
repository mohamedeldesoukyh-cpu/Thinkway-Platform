import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  campaignFactsToPlanningInput,
  generateCampaignStrategy,
  type CampaignStrategy,
} from "@/lib/campaign-planning";
import { discoveryMappedFiltersToCreatorFilters } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/mapped-filters-to-discovery";
import type { CreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";

export function generateStudioCampaignStrategy(facts?: CampaignFacts): CampaignStrategy {
  const brief = facts ?? {
    objective: "Brand awareness",
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
  return generateCampaignStrategy(campaignFactsToPlanningInput(brief));
}

export function generateStudioCampaignStrategyFromObject(
  campaignObject: Pick<CampaignObject, "meta">
): CampaignStrategy | null {
  const facts = getCampaignFacts(campaignObject);
  if (!facts) return null;
  return generateStudioCampaignStrategy(facts);
}

/** Translate generated strategy into Discovery UI filters (Discovery Engine input). */
export function strategyToDiscoveryFilters(strategy: CampaignStrategy): CreatorSearchFilters {
  return discoveryMappedFiltersToCreatorFilters(strategy.discoveryBrief.mappedFilters);
}

export function studioPlanningArtifacts(facts: CampaignFacts): {
  strategy: CampaignStrategy;
  discoveryFilters: CreatorSearchFilters;
} {
  const strategy = generateStudioCampaignStrategy(facts);
  return {
    strategy,
    discoveryFilters: strategyToDiscoveryFilters(strategy),
  };
}
