import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { isExactCreatorLookupSearch, normalizeDiscoverySearchQuery } from "@/lib/discovery/creator-search-query";
import { normalizeDiscoverySearchText } from "@/lib/discovery/discovery-search-normalize";

function normalizeExactToken(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

function normalizeDisplayName(value: string): string {
  return normalizeDiscoverySearchText(normalizeExactToken(value)).replace(/\s+/g, "");
}

function collectCreatorHandles(creator: UnifiedCreatorResult): string[] {
  const handles = new Set<string>();
  for (const platform of creator.platforms) {
    const handle = platform.handle?.trim();
    if (!handle) continue;
    handles.add(normalizeExactToken(handle));
  }
  return [...handles];
}

/** True when creator matches handle, username, or display name exactly (case-insensitive). */
export function creatorMatchesExactSearch(
  creator: UnifiedCreatorResult,
  rawQuery: string
): boolean {
  const query = normalizeDiscoverySearchQuery(rawQuery).trim();
  if (!query) return false;

  const normalizedQuery = normalizeExactToken(query);
  const compactQuery = normalizeDisplayName(query);

  for (const handle of collectCreatorHandles(creator)) {
    if (handle === normalizedQuery) return true;
  }

  const displayName = creator.display_name?.trim();
  if (displayName) {
    const normalizedDisplay = normalizeExactToken(displayName);
    if (normalizedDisplay === normalizedQuery) return true;
    if (normalizeDisplayName(displayName) === compactQuery) return true;
  }

  return false;
}

export function filterExactCreatorMatches(
  creators: UnifiedCreatorResult[],
  rawQuery: string
): UnifiedCreatorResult[] {
  return creators.filter((creator) => creatorMatchesExactSearch(creator, rawQuery));
}

/** Bare names/handles can be incomplete while typing; explicit @handles/URLs stay exact. */
export function filterCreatorLookupMatches(creators: UnifiedCreatorResult[], rawQuery: string): UnifiedCreatorResult[] {
  if (isExactCreatorLookupSearch(rawQuery)) return filterExactCreatorMatches(creators, rawQuery);
  const query = normalizeDisplayName(rawQuery);
  if (query.length < 2) return filterExactCreatorMatches(creators, rawQuery);
  return creators.filter(creator => creatorMatchesExactSearch(creator, rawQuery)
    || normalizeDisplayName(creator.display_name).startsWith(query)
    || collectCreatorHandles(creator).some(handle => normalizeDisplayName(handle).startsWith(query)));
}
