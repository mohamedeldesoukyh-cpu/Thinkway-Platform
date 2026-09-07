"use server";

import { getCampaignOptionsForShortlist, getDiscoveryShortlists } from "@/features/discovery/queries";
import { getCreatorSearchFilterFacets } from "@/lib/discovery/creator-search-filter-facets";
import { getDiscoverySearchTaxonomy } from "@/lib/discovery/search-taxonomy";

/** Shortlists / campaigns / taxonomy / facets — loaded after first Search paint, not on SSR. */
export async function loadCreatorSearchChromeAction(options?: {
  forceFacets?: boolean;
}) {
  const [shortlists, campaigns, taxonomy, facets] = await Promise.all([
    getDiscoveryShortlists(),
    getCampaignOptionsForShortlist(),
    getDiscoverySearchTaxonomy(),
    getCreatorSearchFilterFacets({ force: options?.forceFacets === true }),
  ]);

  return {
    shortlists: shortlists.map((row) => ({ id: row.id, name: row.name })),
    campaigns,
    searchTaxonomyTerms: [...taxonomy.terms],
    filterCategoryLabels: facets.categories.map((row) => row.label),
    filterCountries: facets.countries.map((row) => ({
      code: row.code,
      label: row.label,
    })),
    filterLanguages: facets.languages.map((row) => ({
      code: row.code,
      label: row.label,
    })),
  };
}
