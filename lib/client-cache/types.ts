/** Opaque IndexedDB client-cache entry. IndexedDB is never SSOT. */

export const CLIENT_CACHE_DB_NAME = "thinkway-client-cache";

/** Bump to clear all entries on next open (upgrade path). */
export const CLIENT_CACHE_SCHEMA_VERSION = 1;

export const CLIENT_CACHE_STORES = {
  entries: "entries",
  meta: "meta",
} as const;

export type ClientCacheEntry<T = unknown> = {
  key: string;
  v: number;
  namespace: string;
  kind: string;
  fetchedAt: number;
  softExpiresAt: number;
  hardExpiresAt: number;
  softTtlMs: number;
  hardTtlMs: number;
  tags: string[];
  entityIds: string[];
  payload: T;
};

export type ClientCacheMeta = {
  schemaVersion: number;
  lastVacuumAt: number | null;
};

export type ClientCacheGetResult<T = unknown> =
  | { status: "miss" }
  | { status: "hit"; entry: ClientCacheEntry<T>; stale: false }
  | { status: "stale"; entry: ClientCacheEntry<T>; stale: true };

export type ClientCacheSetOptions = {
  namespace: string;
  kind: string;
  softTtlMs: number;
  hardTtlMs: number;
  tags?: string[];
  entityIds?: string[];
  now?: number;
};

export type ClientCacheTtlPolicy = {
  softTtlMs: number;
  hardTtlMs: number;
};
