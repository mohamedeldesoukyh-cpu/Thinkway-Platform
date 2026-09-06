import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  CLIENT_CACHE_DB_NAME,
  CLIENT_CACHE_SCHEMA_VERSION,
  CLIENT_CACHE_STORES,
  type ClientCacheEntry,
  type ClientCacheMeta,
} from "./types";

interface ThinkwayClientCacheDb extends DBSchema {
  entries: {
    key: string;
    value: ClientCacheEntry;
    indexes: { "by-tag": string; "by-fetchedAt": number };
  };
  meta: {
    key: string;
    value: ClientCacheMeta | { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<ThinkwayClientCacheDb>> | null = null;
let dbInstance: IDBPDatabase<ThinkwayClientCacheDb> | null = null;

export function isClientCacheAvailable(): boolean {
  // Prefer IndexedDB presence over `window` so Node tests with fake-indexeddb work,
  // while SSR (no indexedDB) still no-ops.
  return typeof indexedDB !== "undefined";
}

export async function openClientCacheDb(): Promise<IDBPDatabase<ThinkwayClientCacheDb> | null> {
  if (!isClientCacheAvailable()) return null;

  if (!dbPromise) {
    dbPromise = openDB<ThinkwayClientCacheDb>(CLIENT_CACHE_DB_NAME, CLIENT_CACHE_SCHEMA_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains(CLIENT_CACHE_STORES.entries)) {
          const entries = db.createObjectStore(CLIENT_CACHE_STORES.entries, {
            keyPath: "key",
          });
          entries.createIndex("by-tag", "tags", { multiEntry: true });
          entries.createIndex("by-fetchedAt", "fetchedAt");
        }
        if (!db.objectStoreNames.contains(CLIENT_CACHE_STORES.meta)) {
          db.createObjectStore(CLIENT_CACHE_STORES.meta);
        }

        // Schema bump: clear opaque payloads so stale shapes cannot be treated as live.
        if (oldVersion > 0 && oldVersion < CLIENT_CACHE_SCHEMA_VERSION) {
          transaction.objectStore(CLIENT_CACHE_STORES.entries).clear();
        }
      },
    }).then(async (db) => {
      dbInstance = db;
      await db.put(CLIENT_CACHE_STORES.meta, {
        schemaVersion: CLIENT_CACHE_SCHEMA_VERSION,
        lastVacuumAt: null,
      }, "schema");
      return db;
    });
  }

  try {
    return await dbPromise;
  } catch {
    dbPromise = null;
    dbInstance = null;
    return null;
  }
}

/** Test helper — close + drop singleton so the next open uses a fresh DB handle. */
export async function resetClientCacheDbForTests(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbPromise = null;
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(CLIENT_CACHE_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("deleteDatabase failed"));
    req.onblocked = () => resolve();
  });
}
