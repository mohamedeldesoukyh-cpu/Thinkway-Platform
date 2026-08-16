"use server";

import { getCampaignOptionsForShortlist, getDiscoveryShortlists } from "@/features/discovery/queries";
import { getDiscoverySearchTaxonomy } from "@/lib/discovery/search-taxonomy";

/** Shortlists / campaigns / taxonomy — loaded after first Search paint, not on SSR. */
export async function loadCreatorSearchChromeAction() {
  const [shortlists, campaigns, taxonomy] = await Promise.all([
    getDiscoveryShortlists(),
    getCampaignOptionsForShortlist(),
    getDiscoverySearchTaxonomy(),
  ]);

  return {
    shortlists: shortlists.map((row) => ({ id: row.id, name: row.name })),
    campaigns,
    searchTaxonomyTerms: [...taxonomy.terms],
  };
}
