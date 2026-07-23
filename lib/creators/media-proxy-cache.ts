/**
 * Process-local cache + in-flight dedupe for avatar / publication-preview proxies.
 * Not a distributed cache — good enough to collapse grid fan-out within one server instance.
 */

export type MediaProxyCacheEntry = {
  ok: true;
  buffer: ArrayBuffer;
  contentType: string;
  cachedAt: number;
};

export type MediaProxyNegativeEntry = {
  ok: false;
  status: number;
  cachedAt: number;
};

export type MediaProxyCached = MediaProxyCacheEntry | MediaProxyNegativeEntry;

export type MediaProxyMetricsSnapshot = {
  hits: number;
  misses: number;
  negativeHits: number;
  storageHits: number;
  cdnHits: number;
  placeholders: number;
  refreshScheduled: number;
  refreshSuccess: number;
  refreshFailed: number;
  externalRequests: number;
  inflightJoins: number;
  cacheSize: number;
};

const POSITIVE_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 45 * 1000;
const MAX_ENTRIES = 500;

const cache = new Map<string, MediaProxyCached>();
const inflight = new Map<string, Promise<unknown>>();

const metrics = {
  hits: 0,
  misses: 0,
  negativeHits: 0,
  storageHits: 0,
  cdnHits: 0,
  placeholders: 0,
  refreshScheduled: 0,
  refreshSuccess: 0,
  refreshFailed: 0,
  externalRequests: 0,
  inflightJoins: 0,
};

function isFresh(entry: MediaProxyCached, now: number): boolean {
  const ttl = entry.ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  return now - entry.cachedAt < ttl;
}

function evictIfNeeded(): void {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest == null) break;
    cache.delete(oldest);
  }
}

export function mediaProxyCacheKey(parts: {
  kind: "avatar" | "preview";
  src?: string | null;
  profileUrl?: string | null;
  postUrl?: string | null;
}): string {
  return [
    parts.kind,
    parts.src?.trim() || "",
    parts.profileUrl?.trim() || "",
    parts.postUrl?.trim() || "",
  ].join("|");
}

export function getMediaProxyCache(key: string): MediaProxyCached | null {
  const entry = cache.get(key);
  if (!entry) {
    metrics.misses += 1;
    return null;
  }
  if (!isFresh(entry, Date.now())) {
    cache.delete(key);
    metrics.misses += 1;
    return null;
  }
  // LRU touch
  cache.delete(key);
  cache.set(key, entry);
  if (entry.ok) metrics.hits += 1;
  else metrics.negativeHits += 1;
  return entry;
}

export function setMediaProxyCachePositive(
  key: string,
  buffer: ArrayBuffer,
  contentType: string
): void {
  cache.set(key, {
    ok: true,
    buffer,
    contentType,
    cachedAt: Date.now(),
  });
  evictIfNeeded();
}

export function setMediaProxyCacheNegative(key: string, status = 404): void {
  cache.set(key, {
    ok: false,
    status,
    cachedAt: Date.now(),
  });
  evictIfNeeded();
}

export async function withMediaProxyInflight<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    metrics.inflightJoins += 1;
    return existing as Promise<T>;
  }
  const promise = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export function recordMediaProxyStorageHit(): void {
  metrics.storageHits += 1;
}

export function recordMediaProxyCdnHit(): void {
  metrics.cdnHits += 1;
}

export function recordMediaProxyPlaceholder(): void {
  metrics.placeholders += 1;
}

export function recordMediaProxyRefreshScheduled(): void {
  metrics.refreshScheduled += 1;
}

export function recordMediaProxyRefreshSuccess(): void {
  metrics.refreshSuccess += 1;
}

export function recordMediaProxyRefreshFailed(): void {
  metrics.refreshFailed += 1;
}

export function recordMediaProxyExternalRequest(count = 1): void {
  metrics.externalRequests += count;
}

export function getMediaProxyMetrics(): MediaProxyMetricsSnapshot {
  return {
    ...metrics,
    cacheSize: cache.size,
  };
}

export function resetMediaProxyMetricsForTests(options?: {
  /** Default true — clear LRU + inflight. Pass false to keep warm cache while zeroing counters. */
  clearCache?: boolean;
}): void {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.negativeHits = 0;
  metrics.storageHits = 0;
  metrics.cdnHits = 0;
  metrics.placeholders = 0;
  metrics.refreshScheduled = 0;
  metrics.refreshSuccess = 0;
  metrics.refreshFailed = 0;
  metrics.externalRequests = 0;
  metrics.inflightJoins = 0;
  if (options?.clearCache === false) return;
  cache.clear();
  inflight.clear();
}

export const MEDIA_PROXY_FAST_TIMEOUT_MS = 1_500;
export const MEDIA_PROXY_STORAGE_TIMEOUT_MS = 2_000;
export const MEDIA_PROXY_REFRESH_TIMEOUT_MS = 12_000;
