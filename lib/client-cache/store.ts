import { openClientCacheDb, isClientCacheAvailable } from "./db";
import { resolveTtlBounds, toCacheGetResult } from "./ttl";
import { CLIENT_CACHE_SCHEMA_VERSION, CLIENT_CACHE_STORES } from "./types";
import type {
  ClientCacheEntry,
  ClientCacheGetResult,
  ClientCacheSetOptions,
} from "./types";

export async function getClientCacheEntry<T = unknown>(
  key: string,
  now = Date.now()
): Promise<ClientCacheGetResult<T>> {
  if (!isClientCacheAvailable()) return { status: "miss" };
  const db = await openClientCacheDb();
  if (!db) return { status: "miss" };

  try {
    const entry = (await db.get(CLIENT_CACHE_STORES.entries, key)) as
      | ClientCacheEntry<T>
      | undefined;
    const result = toCacheGetResult(entry, now);
    if (result.status === "miss" && entry) {
      // Hard-expired: best-effort delete; ignore failures.
      void db.delete(CLIENT_CACHE_STORES.entries, key).catch(() => undefined);
    }
    return result;
  } catch {
    return { status: "miss" };
  }
}

export async function setClientCacheEntry<T>(
  key: string,
  payload: T,
  options: ClientCacheSetOptions
): Promise<boolean> {
  if (!isClientCacheAvailable()) return false;
  const db = await openClientCacheDb();
  if (!db) return false;

  const now = options.now ?? Date.now();
  const { softExpiresAt, hardExpiresAt } = resolveTtlBounds(
    { softTtlMs: options.softTtlMs, hardTtlMs: options.hardTtlMs },
    now
  );

  const entry: ClientCacheEntry<T> = {
    key,
    v: CLIENT_CACHE_SCHEMA_VERSION,
    namespace: options.namespace,
    kind: options.kind,
    fetchedAt: now,
    softExpiresAt,
    hardExpiresAt,
    softTtlMs: options.softTtlMs,
    hardTtlMs: options.hardTtlMs,
    tags: options.tags ?? [],
    entityIds: options.entityIds ?? [],
    payload,
  };

  try {
    await db.put(CLIENT_CACHE_STORES.entries, entry as ClientCacheEntry);
    return true;
  } catch {
    return false;
  }
}

export async function deleteClientCacheEntry(key: string): Promise<boolean> {
  if (!isClientCacheAvailable()) return false;
  const db = await openClientCacheDb();
  if (!db) return false;
  try {
    await db.delete(CLIENT_CACHE_STORES.entries, key);
    return true;
  } catch {
    return false;
  }
}

export async function clearClientCacheEntries(): Promise<boolean> {
  if (!isClientCacheAvailable()) return false;
  const db = await openClientCacheDb();
  if (!db) return false;
  try {
    await db.clear(CLIENT_CACHE_STORES.entries);
    return true;
  } catch {
    return false;
  }
}
