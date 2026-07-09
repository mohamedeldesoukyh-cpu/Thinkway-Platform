type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class MemoryCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count += 1;
      }
    }
    return count;
  }

  invalidateByEntity(entityType: string, entityId: string): number {
    return (
      this.invalidatePrefix(`${entityType}:${entityId}:`) +
      this.invalidatePrefix(`entity:${entityType}:${entityId}`)
    );
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const KNOWLEDGE_CACHE_TTL_MS = 15 * 60 * 1000;

export const knowledgeCache = new MemoryCache<unknown>(KNOWLEDGE_CACHE_TTL_MS);
export const entitySearchCache = new MemoryCache<unknown>(KNOWLEDGE_CACHE_TTL_MS);

export function invalidateKnowledgeForEntity(
  entityType: "campaign" | "client" | "brand" | "creator" | "influencer",
  entityId: string
): void {
  knowledgeCache.invalidateByEntity(entityType, entityId);
  entitySearchCache.invalidateByEntity(entityType, entityId);
  knowledgeCache.invalidatePrefix("knowledge:");
  entitySearchCache.invalidatePrefix("search:");
}

export function registerKnowledgeInvalidationHooks(): void {
  if (typeof globalThis !== "undefined") {
    (globalThis as { __thinkwayKnowledgeCache?: typeof knowledgeCache }).__thinkwayKnowledgeCache =
      knowledgeCache;
  }
}

registerKnowledgeInvalidationHooks();
