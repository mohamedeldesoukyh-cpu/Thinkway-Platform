import { getClientCacheEntry, setClientCacheEntry } from "./store";
import type { ClientCacheGetResult, ClientCacheSetOptions } from "./types";

export type ReadThroughCacheOptions<T> = {
  key: string;
  setOptions: ClientCacheSetOptions;
  /**
   * When true, skip IndexedDB read and always fetch (still write-through on success).
   * Use after mutations / acquisition when painted cache would be misleading.
   */
  bypassCacheRead?: boolean;
  fetcher: () => Promise<T>;
  /**
   * Optional immediate paint of a soft/hard-fresh cache hit before revalidation.
   * Called only when a usable cache entry exists and bypassCacheRead is false.
   */
  onCacheHit?: (result: Extract<ClientCacheGetResult<T>, { status: "hit" | "stale" }>) => void;
};

export type ReadThroughCacheResult<T> = {
  value: T;
  fromCache: boolean;
  stale: boolean;
  networkError?: unknown;
};

/**
 * Stale-while-revalidate helper (no React).
 * Network result always wins and write-through updates IndexedDB.
 * On network failure with a prior cache hit, returns the cached payload.
 */
export async function readThroughClientCache<T>(
  options: ReadThroughCacheOptions<T>
): Promise<ReadThroughCacheResult<T>> {
  let cached: Extract<ClientCacheGetResult<T>, { status: "hit" | "stale" }> | null = null;

  if (!options.bypassCacheRead) {
    const result = await getClientCacheEntry<T>(options.key);
    if (result.status === "hit" || result.status === "stale") {
      cached = result;
      options.onCacheHit?.(result);
    }
  }

  try {
    const value = await options.fetcher();
    await setClientCacheEntry(options.key, value, options.setOptions);
    return {
      value,
      fromCache: false,
      stale: false,
    };
  } catch (networkError) {
    if (cached) {
      return {
        value: cached.entry.payload,
        fromCache: true,
        stale: cached.stale || true,
        networkError,
      };
    }
    throw networkError;
  }
}
