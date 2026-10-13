type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const analyticsCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const requestIds = new WeakMap<object, number>();
let nextRequestId = 0;

/** Scope financial results to the RLS client and every filter, never another user. */
export function analyticsRequestKey(client: object, filters: object): string {
  if (!requestIds.has(client)) requestIds.set(client, ++nextRequestId);
  return `${requestIds.get(client)}:${JSON.stringify(filters)}`;
}

const DEFAULT_TTL_MS = 60_000;

export function buildAnalyticsCacheKey(
  namespace: string,
  parts: Record<string, string | number | boolean | undefined | null>
): string {
  const serialized = Object.entries(parts)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  return `${namespace}:${serialized}`;
}

export async function withAnalyticsCache<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const hit = analyticsCache.get(key) as CacheEntry<T> | undefined;

  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const work = factory();
  inFlight.set(key, work);
  try {
    const value = await work;
    for (const [entryKey, entry] of analyticsCache) {
      if (entry.expiresAt <= now) analyticsCache.delete(entryKey);
    }
    analyticsCache.set(key, { expiresAt: now + ttlMs, value });
    return value;
  } finally {
    inFlight.delete(key);
  }
}

export function invalidateAnalyticsCache(namespace?: string): void {
  if (!namespace) {
    analyticsCache.clear();
    return;
  }
  for (const key of analyticsCache.keys()) {
    if (key.startsWith(`${namespace}:`)) {
      analyticsCache.delete(key);
    }
  }
}

export function getAnalyticsCacheStats(): {
  entries: number;
  namespaces: string[];
} {
  const namespaces = new Set<string>();
  for (const key of analyticsCache.keys()) {
    const ns = key.split(":")[0] ?? key;
    namespaces.add(ns);
  }
  return { entries: analyticsCache.size, namespaces: [...namespaces] };
}
