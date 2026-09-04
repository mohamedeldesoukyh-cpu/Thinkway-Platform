/**
 * Pack `cr(handle)` — resolve a creator across shortlist + search (and any other) pools.
 * Silent empty modal happens when only one pool is searched.
 */
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function creatorMatchesHandle(
  creator: UnifiedCreatorResult,
  handleOrId: string
): boolean {
  const needle = normalizeHandle(handleOrId);
  if (!needle) return false;
  if (creator.unified_id.toLowerCase() === needle) return true;
  if (creator.discovered_profile_id?.toLowerCase() === needle) return true;
  if (creator.influencer_id?.toLowerCase() === needle) return true;
  for (const platform of creator.platforms) {
    const h = platform.handle?.replace(/^@+/, "").toLowerCase();
    if (h && h === needle) return true;
  }
  return false;
}

/** First match across pools in order (shortlist CR before search POOL, per pack). */
export function resolveCreatorAcrossPools(
  handleOrId: string,
  ...pools: Array<Iterable<UnifiedCreatorResult> | null | undefined>
): UnifiedCreatorResult | null {
  const needle = normalizeHandle(handleOrId);
  if (!needle) return null;
  for (const pool of pools) {
    if (!pool) continue;
    for (const creator of pool) {
      if (creatorMatchesHandle(creator, needle)) return creator;
    }
  }
  return null;
}
