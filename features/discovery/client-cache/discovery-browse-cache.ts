import {
  CLIENT_CACHE_SCHEMA_VERSION,
  DISCOVERY_BROWSE_TTL,
  buildClientCacheKey,
  clientCacheKeyPrefix,
  getClientCacheEntry,
  hashStable,
  invalidateClientCacheByPrefix,
  invalidateClientCacheByTag,
  setClientCacheEntry,
  stableStringify,
} from "@/lib/client-cache";
import type { UnifiedCreatorBrowseResult, UnifiedCreatorResult } from "@/lib/creators/types";

export const DISCOVERY_CACHE_NAMESPACE = "discovery";
export const DISCOVERY_BROWSE_KIND = "browse";
export const DISCOVERY_BROWSE_TAG = "discovery:browse";

/** Entity tag written onto browse pages that include this creator. */
export function discoveryCreatorEntityTag(unifiedId: string): string {
  return `entity:creator:${unifiedId.trim()}`;
}

/** Browse params used for cache fingerprinting (canonical filtersToBrowseParams shape). */
export type DiscoveryBrowseCacheParams = {
  page: number;
  pageSize: number;
  productionOnly?: boolean;
  [key: string]: unknown;
};

export type DiscoveryBrowseCachePayload = Pick<
  UnifiedCreatorBrowseResult,
  | "creators"
  | "total"
  | "has_more"
  | "page"
  | "pageSize"
  | "internal_count"
  | "discovery_count"
> & {
  /** Optional backfill meta from the action — stored but never treated as SSOT. */
  backfill?: UnifiedCreatorBrowseResult["backfill"];
  coverage?: UnifiedCreatorBrowseResult["coverage"];
};

/**
 * Fingerprint excludes volatile session fields (searchSessionId, skipCoverageBackfill).
 * Callers should pass the object returned by filtersToBrowseParams.
 */
export function fingerprintDiscoveryBrowseParams(
  params: DiscoveryBrowseCacheParams
): string {
  const {
    searchSessionId: _session,
    skipCoverageBackfill: _skip,
    ...stable
  } = params as DiscoveryBrowseCacheParams & {
    searchSessionId?: unknown;
    skipCoverageBackfill?: unknown;
  };
  return hashStable(stable);
}

export function buildDiscoveryBrowseCacheKey(input: {
  userId: string;
  browseParams: DiscoveryBrowseCacheParams;
}): string {
  return buildClientCacheKey({
    schemaVersion: CLIENT_CACHE_SCHEMA_VERSION,
    userId: input.userId,
    namespace: DISCOVERY_CACHE_NAMESPACE,
    kind: DISCOVERY_BROWSE_KIND,
    fingerprint: fingerprintDiscoveryBrowseParams(input.browseParams),
  });
}

export function discoveryBrowseCachePrefix(userId: string): string {
  return clientCacheKeyPrefix({
    schemaVersion: CLIENT_CACHE_SCHEMA_VERSION,
    userId,
    namespace: DISCOVERY_CACHE_NAMESPACE,
    kind: DISCOVERY_BROWSE_KIND,
  });
}

export function entityTagsFromCreators(creators: UnifiedCreatorResult[]): string[] {
  const tags = new Set<string>([DISCOVERY_BROWSE_TAG]);
  for (const creator of creators) {
    if (creator.unified_id) {
      tags.add(discoveryCreatorEntityTag(creator.unified_id));
    }
  }
  return [...tags];
}

export function toDiscoveryBrowseCachePayload(
  result: UnifiedCreatorBrowseResult
): DiscoveryBrowseCachePayload {
  return {
    creators: result.creators,
    total: result.total,
    has_more: result.has_more,
    page: result.page,
    pageSize: result.pageSize,
    internal_count: result.internal_count,
    discovery_count: result.discovery_count,
    backfill: result.backfill,
    coverage: result.coverage,
  };
}

export async function readDiscoveryBrowseCache(input: {
  userId: string;
  browseParams: DiscoveryBrowseCacheParams;
}) {
  if (!input.userId.trim()) {
    return { status: "miss" as const };
  }
  const key = buildDiscoveryBrowseCacheKey(input);
  return getClientCacheEntry<DiscoveryBrowseCachePayload>(key);
}

export async function writeDiscoveryBrowseCache(input: {
  userId: string;
  browseParams: DiscoveryBrowseCacheParams;
  result: UnifiedCreatorBrowseResult;
}): Promise<boolean> {
  if (!input.userId.trim()) return false;
  const key = buildDiscoveryBrowseCacheKey(input);
  const payload = toDiscoveryBrowseCachePayload(input.result);
  return setClientCacheEntry(key, payload, {
    namespace: DISCOVERY_CACHE_NAMESPACE,
    kind: DISCOVERY_BROWSE_KIND,
    softTtlMs: DISCOVERY_BROWSE_TTL.softTtlMs,
    hardTtlMs: DISCOVERY_BROWSE_TTL.hardTtlMs,
    tags: entityTagsFromCreators(input.result.creators),
    entityIds: input.result.creators.map((c) => c.unified_id).filter(Boolean),
  });
}

export async function invalidateDiscoveryBrowseCache(userId: string): Promise<number> {
  if (!userId.trim()) return 0;
  return invalidateClientCacheByPrefix(discoveryBrowseCachePrefix(userId));
}

/**
 * Drop browse pages tagged with this creator (metrics / PR / commercial list upserts).
 * Prefer this when the affected creator id is known.
 */
export async function invalidateDiscoveryBrowseCacheForCreator(
  unifiedId: string
): Promise<number> {
  const id = unifiedId.trim();
  if (!id) return 0;
  return invalidateClientCacheByTag(discoveryCreatorEntityTag(id));
}

/** Exported for tests — proves fingerprint ignores session volatility. */
export function discoveryBrowseFingerprintDebug(params: DiscoveryBrowseCacheParams): string {
  return `${fingerprintDiscoveryBrowseParams(params)}:${stableStringify({
    page: params.page,
    pageSize: params.pageSize,
    productionOnly: params.productionOnly ?? true,
  })}`;
}
