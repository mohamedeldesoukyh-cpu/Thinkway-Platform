export {
  CLIENT_CACHE_DB_NAME,
  CLIENT_CACHE_SCHEMA_VERSION,
  CLIENT_CACHE_STORES,
  type ClientCacheEntry,
  type ClientCacheGetResult,
  type ClientCacheMeta,
  type ClientCacheSetOptions,
  type ClientCacheTtlPolicy,
} from "./types";

export {
  isClientCacheAvailable,
  openClientCacheDb,
  resetClientCacheDbForTests,
} from "./db";

export {
  buildClientCacheKey,
  buildFingerprintedKey,
  clientCacheKeyPrefix,
  hashStable,
  stableStringify,
} from "./keys";

export {
  DISCOVERY_BROWSE_TTL,
  classifyCacheFreshness,
  resolveTtlBounds,
  toCacheGetResult,
} from "./ttl";

export {
  clearClientCacheEntries,
  deleteClientCacheEntry,
  getClientCacheEntry,
  setClientCacheEntry,
} from "./store";

export {
  invalidateClientCacheByPrefix,
  invalidateClientCacheByTag,
  invalidateClientCacheKeys,
  listClientCacheEntriesByPrefix,
} from "./invalidate";

export { readThroughClientCache } from "./swr";
export type { ReadThroughCacheOptions, ReadThroughCacheResult } from "./swr";
