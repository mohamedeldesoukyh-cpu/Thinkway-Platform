type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const analyticsCache = new Map<string, CacheEntry<unknown>>();

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

  const value = await factory();
  analyticsCache.set(key, { expiresAt: now + ttlMs, value });
  return value;
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
