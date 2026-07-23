import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { creatorListRowEquivalent } from "@/lib/creators/creator-list-row-equivalent";
import { parseProfileInput } from "@/lib/social/parse-profile-url";

/** Convert pasted profile URLs/handles into a searchable @handle query. */
export function normalizeDiscoverySearchQuery(input: string): string {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) return trimmed;

  const parsed = parseProfileInput(trimmed);
  if (parsed) return `@${parsed.normalized_username}`;

  return trimmed;
}

/**
 * True when the user is looking up one specific creator (@handle / profile URL),
 * not running a thematic coverage search. These must not trigger mass Apify
 * dataset acquisition.
 */
export function isExactCreatorLookupSearch(input: string | null | undefined): boolean {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) return false;
  if (parseProfileInput(trimmed)) return true;
  // Bare @handle (no spaces) — Creator Search normalizes URLs to this form.
  return /^@[a-zA-Z0-9._]{2,}$/.test(trimmed);
}

/** Best search query for a unified creator row (prefer primary platform handle). */
export function resolveCreatorSearchQueryFromCreator(
  creator: UnifiedCreatorResult
): string {
  const handle = creator.platforms[0]?.handle?.replace(/^@+/, "").trim();
  if (handle) return `@${handle}`;

  const displayName = creator.display_name?.trim();
  if (displayName) return normalizeDiscoverySearchQuery(displayName);

  return "";
}

/** Insert or replace a creator in an in-memory result list. */
export function upsertCreatorInResults(
  creators: UnifiedCreatorResult[],
  next: UnifiedCreatorResult
): { creators: UnifiedCreatorResult[]; inserted: boolean } {
  const existingIndex = creators.findIndex((c) => c.unified_id === next.unified_id);
  if (existingIndex >= 0) {
    const existing = creators[existingIndex];
    if (creatorListRowEquivalent(existing, next)) {
      return { creators, inserted: false };
    }
    return {
      creators: creators.map((c) => (c.unified_id === next.unified_id ? next : c)),
      inserted: false,
    };
  }
  return { creators: [next, ...creators], inserted: true };
}
