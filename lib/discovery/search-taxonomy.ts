import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DiscoverySearchTaxonomy } from "@/features/discovery/components/creator-search/creator-search-taxonomy";
import { buildDiscoverySearchTaxonomyIndex } from "@/features/discovery/components/creator-search/creator-search-taxonomy";

const TAXONOMY_TTL_MS = 15 * 60 * 1000;

type TaxonomyCache = {
  expiresAt: number;
  taxonomy: DiscoverySearchTaxonomy;
};

let taxonomyCache: TaxonomyCache | null = null;

type TaxonomyRpcRow = { term: string };

export async function getDiscoverySearchTaxonomy(): Promise<DiscoverySearchTaxonomy> {
  const now = Date.now();
  if (taxonomyCache && taxonomyCache.expiresAt > now) {
    return taxonomyCache.taxonomy;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_discovery_search_taxonomy");

  if (error) {
    const rpcMissing =
      error.message.includes("get_discovery_search_taxonomy") ||
      error.code === "PGRST202" ||
      error.code === "42883";

    if (rpcMissing) {
      const fallback = buildDiscoverySearchTaxonomyIndex([]);
      taxonomyCache = { expiresAt: now + TAXONOMY_TTL_MS, taxonomy: fallback };
      return fallback;
    }

    throw new Error(error.message);
  }

  const terms = ((data as TaxonomyRpcRow[] | null) ?? [])
    .map((row) => row.term)
    .filter((term): term is string => typeof term === "string" && term.trim().length > 0);

  const taxonomy = buildDiscoverySearchTaxonomyIndex(terms);
  taxonomyCache = { expiresAt: now + TAXONOMY_TTL_MS, taxonomy };
  return taxonomy;
}

/** Test helper — reset in-memory cache between runs. */
export function resetDiscoverySearchTaxonomyCache(): void {
  taxonomyCache = null;
}
