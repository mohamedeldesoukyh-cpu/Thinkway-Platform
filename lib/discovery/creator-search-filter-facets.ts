/**
 * Live Creator Search filter facets — categories / countries present on the
 * active creator catalog. Grows as new creators (and tags) are added.
 *
 * Server-only loader. Client UI must import merge helpers from
 * `creator-search-filter-facet-merge.ts` (no next/headers).
 */

import {
  mapDiscoveryDatabaseStatsRows,
  type DiscoveryDatabaseStatsRpcRow,
} from "@/lib/discovery/database-stats";
import { countryLabel } from "@/features/discovery/components/creator-search/creator-search-filter-constants";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CreatorSearchCategoryFacet,
  CreatorSearchCountryFacet,
} from "@/lib/discovery/creator-search-filter-facet-merge";

export type {
  CreatorSearchCategoryFacet,
  CreatorSearchCountryFacet,
} from "@/lib/discovery/creator-search-filter-facet-merge";

export type CreatorSearchFilterFacets = {
  categories: CreatorSearchCategoryFacet[];
  countries: CreatorSearchCountryFacet[];
  loadedAt: number;
};

const FACETS_TTL_MS = 15 * 60 * 1000;
/** High enough to cover real niche tags beyond the masthead top-8. */
const CATEGORY_FACET_LIMIT = 200;
const COUNTRY_SAMPLE_LIMIT = 2_000;

type FacetsCache = {
  expiresAt: number;
  facets: CreatorSearchFilterFacets;
};

let facetsCache: FacetsCache | null = null;

const EMPTY_FACETS: CreatorSearchFilterFacets = {
  categories: [],
  countries: [],
  loadedAt: 0,
};

async function loadLiveCategoryFacets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<CreatorSearchCategoryFacet[]> {
  const { data, error } = await supabase.rpc("get_discovery_database_stats", {
    category_limit: CATEGORY_FACET_LIMIT,
  });

  if (error || !data) {
    return [];
  }

  return mapDiscoveryDatabaseStatsRows(
    data as DiscoveryDatabaseStatsRpcRow[]
  ).topCategories.filter((row) => row.label.trim().length > 0 && row.count > 0);
}

async function loadLiveCountryFacets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<CreatorSearchCountryFacet[]> {
  const { data, error } = await supabase
    .from("influencers")
    .select("country_code, country_codes")
    .neq("status", "archived")
    .limit(COUNTRY_SAMPLE_LIMIT);

  if (error || !data) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    const codes = new Set<string>();
    const primary = normalizeCountryCode(
      typeof row.country_code === "string" ? row.country_code : ""
    );
    if (primary) codes.add(primary);
    if (Array.isArray(row.country_codes)) {
      for (const raw of row.country_codes) {
        const code = normalizeCountryCode(typeof raw === "string" ? raw : "");
        if (code) codes.add(code);
      }
    }
    for (const code of codes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      label: countryLabel(code),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function getCreatorSearchFilterFacets(options?: {
  force?: boolean;
}): Promise<CreatorSearchFilterFacets> {
  const now = Date.now();
  if (!options?.force && facetsCache && facetsCache.expiresAt > now) {
    return facetsCache.facets;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const [categories, countries] = await Promise.all([
      loadLiveCategoryFacets(supabase),
      loadLiveCountryFacets(supabase),
    ]);

    const facets: CreatorSearchFilterFacets = {
      categories,
      countries,
      loadedAt: now,
    };
    facetsCache = { expiresAt: now + FACETS_TTL_MS, facets };
    return facets;
  } catch {
    // Soft-fail — filter UI keeps seed chips.
    return { ...EMPTY_FACETS, loadedAt: now };
  }
}

/** Test helper — reset in-memory cache between runs. */
export function resetCreatorSearchFilterFacetsCache(): void {
  facetsCache = null;
}
