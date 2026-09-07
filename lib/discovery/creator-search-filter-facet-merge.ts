/**
 * Pure merge helpers for Creator Search filter facets.
 * Safe for client components — no Supabase / next/headers imports.
 */

import { countryLabel } from "@/features/discovery/components/creator-search/creator-search-filter-constants";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";

export type CreatorSearchCategoryFacet = {
  label: string;
  count: number;
};

export type CreatorSearchCountryFacet = {
  code: string;
  label: string;
  count: number;
};

/**
 * Merge seed labels with live catalog facets (case-insensitive dedupe).
 * Live labels win; seeds fill gaps so empty catalogs still show basics.
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
