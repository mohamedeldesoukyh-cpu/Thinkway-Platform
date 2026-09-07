/**
 * Live Creator Search filter facets — categories / countries present on the
 * active creator catalog. Grows as new creators (and tags) are added.
 */

import {
  mapDiscoveryDatabaseStatsRows,
  type DiscoveryDatabaseStatsRpcRow,
} from "@/lib/discovery/database-stats";
import { countryLabel } from "@/features/discovery/components/creator-search/creator-search-filter-constants";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";

const FACETS_TTL_MS = 15 * 60 * 1000;
/** High enough to cover real niche tags beyond the masthead top-8. */
const CATEGORY_FACET_LIMIT = 200;
const COUNTRY_SAMPLE_LIMIT = 2_000;

export type CreatorSearchCategoryFacet = {
  label: string;
  count: number;
};

export type CreatorSearchCountryFacet = {
  code: string;
  label: string;
  count: number;
};

export type CreatorSearchFilterFacets = {
  categories: CreatorSearchCategoryFacet[];
  countries: CreatorSearchCountryFacet[];
  loadedAt: number;
};

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

/**
 * Merge seed labels with live catalog facets (case-insensitive dedupe).
 * Live labels/counts win; seeds fill gaps so empty catalogs still show basics.
 */
export function mergeCategoryFacetLabels(
  live: ReadonlyArray<CreatorSearchCategoryFacet>,
  seedLabels: ReadonlyArray<string>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const facet of live) {
    const label = facet.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }

  for (const seed of seedLabels) {
    const label = seed.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }

  return out;
}

export function mergeCountryFacetOptions(
  live: ReadonlyArray<CreatorSearchCountryFacet>,
  seed: ReadonlyArray<{ code: string; label: string }>
): Array<{ code: string; label: string }> {
  const seen = new Set<string>();
  const out: Array<{ code: string; label: string }> = [];

  for (const facet of live) {
    const code = normalizeCountryCode(facet.code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      label: facet.label.trim() || countryLabel(code),
    });
  }

  for (const entry of seed) {
    const code = normalizeCountryCode(entry.code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, label: entry.label });
  }

  return out;
}

type FacetSupabase = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (cols: string) => {
      neq: (
        col: string,
        val: string
      ) => {
        limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

async function loadLiveCategoryFacets(
  supabase: FacetSupabase
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
  supabase: FacetSupabase
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
  for (const row of data as Array<{
    country_code?: unknown;
    country_codes?: unknown;
  }>) {
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
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = (await createSupabaseServerClient()) as unknown as FacetSupabase;
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
