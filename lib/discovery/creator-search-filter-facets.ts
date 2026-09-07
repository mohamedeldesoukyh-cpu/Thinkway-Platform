/**
 * Live Creator Search filter facets — categories / countries / languages present
 * on the active creator catalog. Grows as new creators (and tags) are added.
 *
 * Server-only loader. Client UI must import merge helpers from
 * `creator-search-filter-facet-merge.ts` (no next/headers).
 *
 * Categories/languages use direct table scans (same pattern as countries).
 * The masthead stats RPC is not used here — anon/session clients often lack
 * EXECUTE on get_discovery_database_stats.
 */

import { countryLabel, languageLabel } from "@/features/discovery/components/creator-search/creator-search-filter-constants";
import {
  canonicalizeCategoryFacetLabel,
  isUsefulCategoryFacetLabel,
  type CreatorSearchCategoryFacet,
  type CreatorSearchCountryFacet,
  type CreatorSearchLanguageFacet,
} from "@/lib/discovery/creator-search-filter-facet-merge";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type {
  CreatorSearchCategoryFacet,
  CreatorSearchCountryFacet,
  CreatorSearchLanguageFacet,
} from "@/lib/discovery/creator-search-filter-facet-merge";

export type CreatorSearchFilterFacets = {
  categories: CreatorSearchCategoryFacet[];
  countries: CreatorSearchCountryFacet[];
  languages: CreatorSearchLanguageFacet[];
  loadedAt: number;
};

const FACETS_TTL_MS = 15 * 60 * 1000;
/** Cap chips so the drawer stays usable; ordered by catalog frequency. */
const CATEGORY_FACET_LIMIT = 200;
const LANGUAGE_FACET_LIMIT = 40;
/** Sample size — enough for MENA catalogs without full-table timeouts. */
const CATALOG_SAMPLE_LIMIT = 5_000;
const INTEREST_SAMPLE_LIMIT = 3_000;

type FacetsCache = {
  expiresAt: number;
  facets: CreatorSearchFilterFacets;
};

let facetsCache: FacetsCache | null = null;

const EMPTY_FACETS: CreatorSearchFilterFacets = {
  categories: [],
  countries: [],
  languages: [],
  loadedAt: 0,
};

function bumpCount(map: Map<string, { label: string; count: number }>, raw: string) {
  const label = canonicalizeCategoryFacetLabel(raw);
  if (!isUsefulCategoryFacetLabel(label)) return;
  const key = label.toLowerCase();
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  map.set(key, { label, count: 1 });
}

async function loadLiveCategoryFacets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<CreatorSearchCategoryFacet[]> {
  const counts = new Map<string, { label: string; count: number }>();

  const { data: influencers, error: influencerError } = await supabase
    .from("influencers")
    .select("categories")
    .neq("status", "archived")
    .limit(CATALOG_SAMPLE_LIMIT);

  if (!influencerError && influencers) {
    for (const row of influencers) {
      if (!Array.isArray(row.categories)) continue;
      const seenOnCreator = new Set<string>();
      for (const raw of row.categories) {
        if (typeof raw !== "string") continue;
        const key = canonicalizeCategoryFacetLabel(raw).toLowerCase();
        if (!key || seenOnCreator.has(key)) continue;
        seenOnCreator.add(key);
        bumpCount(counts, raw);
      }
    }
  }

  // Interest tags often carry niches not copied onto influencers.categories.
  const { data: accounts, error: accountError } = await supabase
    .from("influencer_platform_accounts")
    .select("interest_categories")
    .not("interest_categories", "eq", "{}")
    .limit(INTEREST_SAMPLE_LIMIT);

  if (!accountError && accounts) {
    for (const row of accounts) {
      if (!Array.isArray(row.interest_categories)) continue;
      const seenOnAccount = new Set<string>();
      for (const raw of row.interest_categories) {
        if (typeof raw !== "string") continue;
        const key = canonicalizeCategoryFacetLabel(raw).toLowerCase();
        if (!key || seenOnAccount.has(key)) continue;
        seenOnAccount.add(key);
        bumpCount(counts, raw);
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, CATEGORY_FACET_LIMIT);
}

async function loadLiveCountryFacets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<CreatorSearchCountryFacet[]> {
  const { data, error } = await supabase
    .from("influencers")
    .select("country_code, country_codes")
    .neq("status", "archived")
    .limit(CATALOG_SAMPLE_LIMIT);

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

async function loadLiveLanguageFacets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<CreatorSearchLanguageFacet[]> {
  const { data, error } = await supabase
    .from("influencers")
    .select("languages")
    .neq("status", "archived")
    .limit(CATALOG_SAMPLE_LIMIT);

  if (error || !data) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    if (!Array.isArray(row.languages)) continue;
    const codes = new Set<string>();
    for (const raw of row.languages) {
      if (typeof raw !== "string") continue;
      const code = raw.trim().toLowerCase();
      if (!code || code.length > 12) continue;
      codes.add(code);
    }
    for (const code of codes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      label: languageLabel(code),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, LANGUAGE_FACET_LIMIT);
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
    const [categories, countries, languages] = await Promise.all([
      loadLiveCategoryFacets(supabase),
      loadLiveCountryFacets(supabase),
      loadLiveLanguageFacets(supabase),
    ]);

    const facets: CreatorSearchFilterFacets = {
      categories,
      countries,
      languages,
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
