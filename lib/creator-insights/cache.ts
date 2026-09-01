import type { CreatorInsightPack } from "./types";

type CacheEntry = {
  fingerprint: string;
  expiresAt: number;
  pack: CreatorInsightPack;
};

const PACK_TTL_MS = 15 * 60 * 1000;
const packCache = new Map<string, CacheEntry>();

export function insightCacheKey(influencerId: string): string {
  return `creator-insights:${influencerId}`;
}

export function invalidateCreatorInsightCache(influencerId: string): void {
  packCache.delete(insightCacheKey(influencerId));
}

export function readCreatorInsightCache(
  influencerId: string,
  fingerprint: string,
  now = Date.now()
): CreatorInsightPack | null {
  const entry = packCache.get(insightCacheKey(influencerId));
  if (!entry) return null;
  if (entry.fingerprint !== fingerprint) return null;
  if (entry.expiresAt <= now) {
    packCache.delete(insightCacheKey(influencerId));
    return null;
  }
  return entry.pack;
}

export function writeCreatorInsightCache(
  influencerId: string,
  fingerprint: string,
  pack: CreatorInsightPack,
  now = Date.now()
): void {
  packCache.set(insightCacheKey(influencerId), {
    fingerprint,
    pack,
    expiresAt: now + PACK_TTL_MS,
  });
}

export function fingerprintCreatorInsightInputs(parts: {
  influencerId: string;
  publicationStamp: string | null;
  insightStamp: string | null;
  syncStamp: string | null;
  unitStamp: string | null;
  feeStamp?: string | null;
}): string {
  return [
    parts.influencerId,
    parts.publicationStamp ?? "",
    parts.insightStamp ?? "",
    parts.syncStamp ?? "",
    parts.unitStamp ?? "",
    parts.feeStamp ?? "",
  ].join("|");
}
