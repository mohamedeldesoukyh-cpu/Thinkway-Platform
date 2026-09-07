/**
 * Pure merge helpers for Creator Search filter facets.
 * Safe for client components — no Supabase / next/headers imports.
 */

import {
  countryLabel,
  languageLabel,
} from "@/features/discovery/components/creator-search/creator-search-filter-constants";
import { isNonContentCategoryLabel } from "@/lib/creators/category-signal-quality";
import { CREATOR_CATEGORY_LABELS } from "@/lib/creators/category-keywords";
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

export type CreatorSearchLanguageFacet = {
  code: string;
  label: string;
  count: number;
};

/** Hashtag / spam tags that should not become filter chips. */
const CATEGORY_FACET_JUNK = new Set([
  "none",
  "fyp",
  "foryou",
  "foryoupage",
  "fypシ",
  "fypシviral",
  "viral",
  "viralvideo",
  "trending",
  "xyzbca",
  "fy",
  "go",
  "ai",
  "can't",
  "cant",
  "tiktok",
  "instagram",
  "reel creator",
  "reels",
]);

/**
 * Prefer canonical Discovery labels (Sports, Beauty, …) when casing differs.
 */
export function canonicalizeCategoryFacetLabel(raw: string): string {
  const trimmed = raw.trim().replace(/^#+/, "");
  if (!trimmed) return "";
  const key = trimmed.toLowerCase();
  const canonical = CREATOR_CATEGORY_LABELS.find(
    (label) => label.toLowerCase() === key
  );
  return canonical ?? trimmed;
}

/** Drop account-type / spam / empty tags from live category chips. */
export function isUsefulCategoryFacetLabel(raw: string): boolean {
  const label = canonicalizeCategoryFacetLabel(raw);
  if (!label) return false;
  if (label.length > 64) return false;
  if (CATEGORY_FACET_JUNK.has(label.toLowerCase())) return false;
  if (isNonContentCategoryLabel(label)) return false;
  // Pure ISO country codes wrongly stored as categories (EG, AE).
  if (/^[A-Za-z]{2}$/.test(label) && normalizeCountryCode(label)) return false;
  return true;
}

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
    if (!isUsefulCategoryFacetLabel(facet.label)) continue;
    const label = canonicalizeCategoryFacetLabel(facet.label);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }

  for (const seed of seedLabels) {
    if (!isUsefulCategoryFacetLabel(seed)) continue;
    const label = canonicalizeCategoryFacetLabel(seed);
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

export function mergeLanguageFacetOptions(
  live: ReadonlyArray<CreatorSearchLanguageFacet>,
  seed: ReadonlyArray<{ code: string; label: string }>
): Array<{ code: string; label: string }> {
  const seen = new Set<string>();
  const out: Array<{ code: string; label: string }> = [];

  for (const facet of live) {
    const code = facet.code.trim().toLowerCase();
    if (!code || code.length > 12 || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      label: facet.label.trim() || languageLabel(code),
    });
  }

  for (const entry of seed) {
    const code = entry.code.trim().toLowerCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, label: entry.label });
  }

  return out;
}
