import { openClientCacheDb, isClientCacheAvailable } from "./db";
import { CLIENT_CACHE_STORES } from "./types";
import type { ClientCacheEntry } from "./types";

const INVALIDATE_CHANNEL = "thinkway-client-cache-invalidate";

export type ClientCacheInvalidateMessage =
  | { type: "prefix"; prefix: string }
  | { type: "tag"; tag: string }
  | { type: "keys"; keys: string[] }
  | { type: "clear" };

function publishInvalidation(message: ClientCacheInvalidateMessage): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(INVALIDATE_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // Optional cross-tab bus — never block callers.
  }
}

export async function invalidateClientCacheByPrefix(prefix: string): Promise<number> {
  if (!isClientCacheAvailable() || !prefix) return 0;
  const db = await openClientCacheDb();
  if (!db) return 0;

  let removed = 0;
  try {
    const tx = db.transaction(CLIENT_CACHE_STORES.entries, "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (cursor.key.toString().startsWith(prefix)) {
        await cursor.delete();
        removed += 1;
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {
    return removed;
  }

  publishInvalidation({ type: "prefix", prefix });
  return removed;
}

export async function invalidateClientCacheByTag(tag: string): Promise<number> {
  if (!isClientCacheAvailable() || !tag) return 0;
  const db = await openClientCacheDb();
  if (!db) return 0;

  let removed = 0;
  try {
    const tx = db.transaction(CLIENT_CACHE_STORES.entries, "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (cursor.value.tags.includes(tag)) {
        await cursor.delete();
        removed += 1;
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {
    return removed;
  }

  publishInvalidation({ type: "tag", tag });
  return removed;
}

export async function invalidateClientCacheKeys(keys: string[]): Promise<number> {
  if (!isClientCacheAvailable() || keys.length === 0) return 0;
  const db = await openClientCacheDb();
  if (!db) return 0;

  let removed = 0;
  try {
    const tx = db.transaction(CLIENT_CACHE_STORES.entries, "readwrite");
    for (const key of keys) {
      const existing = await tx.store.get(key);
      if (existing) {
        await tx.store.delete(key);
        removed += 1;
      }
    }
    await tx.done;
  } catch {
    return removed;
  }

  publishInvalidation({ type: "keys", keys });
  return removed;
}

export async function listClientCacheEntriesByPrefix(
  prefix: string
): Promise<ClientCacheEntry[]> {
  if (!isClientCacheAvailable() || !prefix) return [];
  const db = await openClientCacheDb();
  if (!db) return [];

  const out: ClientCacheEntry[] = [];
  try {
    const tx = db.transaction(CLIENT_CACHE_STORES.entries, "readonly");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (cursor.key.toString().startsWith(prefix)) {
        out.push(cursor.value);
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {
    return out;
  }
  return out;
}
