type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const planningCache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60_000;

export function buildPlanningCacheKey(
  namespace: string,
  parts: Record<string, string | number | boolean | undefined | null>
): string {
  const serialized = Object.entries(parts)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  return `planning:${namespace}:${serialized}`;
}

export async function withPlanningCache<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const hit = planningCache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  const value = await factory();
  planningCache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

export function invalidatePlanningCache(namespace?: string): void {
  if (!namespace) {
    planningCache.clear();
    return;
  }
  for (const key of planningCache.keys()) {
    if (key.startsWith(`planning:${namespace}:`)) {
      planningCache.delete(key);
    }
  }
}

export function getPlanningCacheStats(): { entries: number } {
  return { entries: planningCache.size };
}
