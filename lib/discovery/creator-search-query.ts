import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { parseProfileInput } from "@/lib/social/parse-profile-url";

/** Convert pasted profile URLs/handles into a searchable @handle query. */
export function normalizeDiscoverySearchQuery(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const parsed = parseProfileInput(trimmed);
  if (parsed) return `@${parsed.normalized_username}`;

  return trimmed;
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
    return {
      creators: creators.map((c) => (c.unified_id === next.unified_id ? next : c)),
      inserted: false,
    };
  }
  return { creators: [next, ...creators], inserted: true };
}
