import type { CreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

import type {
  CampaignIntelligenceProfile,
  CampaignSearchCriterion,
} from "../types/profile";
import {
  discoveryMappedFiltersToBrowseFilters,
  discoveryMappedFiltersToCreatorFilters,
  discoveryMappedFiltersToCriteria,
  mapCampaignIntelligenceToDiscoverySearch,
} from "./discovery-search-mapping";

/** Map CIP → Discovery-supported filters only (full CIP unchanged elsewhere). */
export function mapProfileToDiscoverySearch(profile: CampaignIntelligenceProfile) {
  return mapCampaignIntelligenceToDiscoverySearch(profile);
}

/**
 * Build Discovery UI criteria from CIP via the mapping layer.
 * Non-searchable CIP fields (objectives, budget, KPIs, brand name, etc.) are excluded.
 */
export function buildSearchStrategyFromProfile(
  profile: CampaignIntelligenceProfile
): CampaignSearchCriterion[] {
  const { filters } = mapCampaignIntelligenceToDiscoverySearch(profile);
  return discoveryMappedFiltersToCriteria(filters);
}

function activeMappedFilters(
  mapped: ReturnType<typeof mapCampaignIntelligenceToDiscoverySearch>["filters"],
  displayCriteria?: CampaignSearchCriterion[]
) {
  if (!displayCriteria || displayCriteria.length === 0) return mapped;
  return mapped.filter((item) => {
    const chip = displayCriteria.find(
      (c) =>
        c.meta?.discoveryKey === item.key && String(c.meta?.rawValue ?? "") === item.value
    );
    return chip != null && chip.enabled;
  });
}

/**
 * Canonical Discovery + Studio browse filters from CIP.
 * Optional display criteria limit which mapped filters apply (chip enable/remove only).
 */
export function buildCreatorFiltersFromProfile(
  profile: CampaignIntelligenceProfile,
  displayCriteria?: CampaignSearchCriterion[]
): CreatorSearchFilters {
  const { filters: mapped } = mapCampaignIntelligenceToDiscoverySearch(profile);
  return discoveryMappedFiltersToCreatorFilters(activeMappedFilters(mapped, displayCriteria));
}

/** Studio-equivalent browse params from CIP (same pipeline as buildCreatorFiltersFromProfile). */
export function buildBrowseFiltersFromProfile(
  profile: CampaignIntelligenceProfile,
  displayCriteria?: CampaignSearchCriterion[],
  page = 1,
  pageSize = 50
): UnifiedCreatorBrowseFilters {
  const { filters: mapped } = mapCampaignIntelligenceToDiscoverySearch(profile);
  return discoveryMappedFiltersToBrowseFilters(
    activeMappedFilters(mapped, displayCriteria),
    page,
    pageSize
  );
}
