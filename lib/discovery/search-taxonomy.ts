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
    // PostgREST/Postgres ~8s statement_timeout: full-scan taxonomy RPC can cancel under load.
    // Do not crash Creator Search SSR — degrade to empty taxonomy (same as missing RPC).
    const timedOut = /statement timeout|canceling statement/i.test(error.message);

    if (rpcMissing || timedOut) {
      const fallback = buildDiscoverySearchTaxonomyIndex([]);
      // Cache only hard-missing RPC. Timeouts are transient — allow the next request to retry.
      if (rpcMissing) {
        taxonomyCache = { expiresAt: now + TAXONOMY_TTL_MS, taxonomy: fallback };
      }
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
