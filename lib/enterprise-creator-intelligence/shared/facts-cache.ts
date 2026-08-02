/**
 * Shared Creator Intelligence cache — compute once, reuse everywhere.
 * Never changes calculations; only prevents unnecessary recomputation.
 */

export type EciCacheKind =
  | "monthly_metrics"
  | "commercial_facts"
  | "category_brand_facts"
  | "performance_facts"
  | "audience_facts"
  | "commercial_intelligence"
  | "category_brand_intelligence"
  | "performance_intelligence"
  | "audience_intelligence"
  | "investment_intelligence"
  | "intelligence_bundle";

export type EciFactsCacheStats = {
  hits: number;
  misses: number;
  computes: number;
  entries: number;
};

export type EciFactsCache = {
  getOrCompute: <T>(
    kind: EciCacheKind,
    influencerId: string,
    platform: string | null | undefined,
    factory: () => Promise<T> | T
  ) => Promise<T>;
  peek: <T>(
    kind: EciCacheKind,
    influencerId: string,
    platform: string | null | undefined
  ) => T | undefined;
  set: <T>(
    kind: EciCacheKind,
    influencerId: string,
    platform: string | null | undefined,
    value: T
  ) => void;
  stats: () => EciFactsCacheStats;
  clear: () => void;
};

function cacheKey(
  kind: EciCacheKind,
  influencerId: string,
  platform: string | null | undefined
): string {
  return `${kind}::${influencerId}::${platform ?? "*"}`;
}

/** Request-scoped / batch-scoped shared cache. */
export function createEciFactsCache(): EciFactsCache {
  const store = new Map<string, unknown>();
  let hits = 0;
  let misses = 0;
  let computes = 0;

  return {
    async getOrCompute(kind, influencerId, platform, factory) {
      const key = cacheKey(kind, influencerId, platform);
      if (store.has(key)) {
        hits += 1;
        return store.get(key) as Awaited<ReturnType<typeof factory>>;
      }
      misses += 1;
      computes += 1;
      const value = await factory();
      store.set(key, value);
      return value;
    },
    peek(kind, influencerId, platform) {
      return store.get(cacheKey(kind, influencerId, platform)) as
        | undefined
        | never;
    },
    set(kind, influencerId, platform, value) {
      store.set(cacheKey(kind, influencerId, platform), value);
    },
    stats() {
      return {
        hits,
        misses,
        computes,
        entries: store.size,
      };
    },
    clear() {
      store.clear();
      hits = 0;
      misses = 0;
      computes = 0;
    },
  };
}
