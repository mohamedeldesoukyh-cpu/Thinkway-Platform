import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { discoveryMappedFiltersToBrowseFilters } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/mapped-filters-to-discovery";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

import { buildCreatorSearchRequirements } from "./creator-search-requirements/build-creator-search-requirements";
import { creatorSearchRequirementsToMappedFilters } from "./creator-search-requirements/creator-search-requirements-to-filters";

/**
 * The campaign's own Discovery filter set, for browsing creators from Studio.
 *
 * Replace could only search Discovery by name or handle, so an operator with no
 * remaining recommended candidates had to already know who they wanted. Browsing
 * needs the campaign's constraints, and those already exist as Creator Search
 * Requirements: the stored CSR when the campaign has one, otherwise built here
 * with the same pure `buildCreatorSearchRequirements` the slate proposal uses.
 * Projection to browse filters is the existing Discovery mapping — no second
 * filter model and no second search.
 */
export function studioCampaignBrowseFilters(
  campaignObject: CampaignObject | undefined,
  options?: { page?: number; pageSize?: number }
): UnifiedCreatorBrowseFilters {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 12;
  const base: UnifiedCreatorBrowseFilters = { page, pageSize, productionOnly: true };
  if (!campaignObject) return base;

  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const requirements =
    creatorsData.searchRequirements ??
    buildCreatorSearchRequirements({
      facts: getCampaignFacts(campaignObject),
      strategy: getStrategyFromWorkflowData(
        campaignObject.meta as unknown as Record<string, unknown>
      ),
      campaignIntelligenceProfileId: creatorsData.cipProfileId,
    });

  const mapped = creatorSearchRequirementsToMappedFilters(requirements).filters;
  return {
    ...discoveryMappedFiltersToBrowseFilters(mapped, page, pageSize),
    ...base,
  };
}

/** True when the campaign contributed at least one real constraint. */
export function hasStudioCampaignBrowseConstraints(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  return Boolean(
    filters.country ||
      filters.creatorCountries?.length ||
      filters.audienceCountries?.length ||
      filters.platform ||
      filters.platforms?.length ||
      filters.category ||
      filters.categories?.length
  );
}
