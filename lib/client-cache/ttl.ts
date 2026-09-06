import type { ClientCacheEntry, ClientCacheGetResult, ClientCacheTtlPolicy } from "./types";

export const DISCOVERY_BROWSE_TTL: ClientCacheTtlPolicy = {
  softTtlMs: 3 * 60_000,
  hardTtlMs: 45 * 60_000,
};

export function resolveTtlBounds(
  policy: ClientCacheTtlPolicy,
  now = Date.now()
): { softExpiresAt: number; hardExpiresAt: number } {
  const softTtlMs = Math.max(0, policy.softTtlMs);
  const hardTtlMs = Math.max(softTtlMs, policy.hardTtlMs);
  return {
    softExpiresAt: now + softTtlMs,
    hardExpiresAt: now + hardTtlMs,
  };
}

export function classifyCacheFreshness(
  entry: Pick<ClientCacheEntry, "softExpiresAt" | "hardExpiresAt">,
  now = Date.now()
): ClientCacheGetResult["status"] {
  if (now >= entry.hardExpiresAt) return "miss";
  if (now >= entry.softExpiresAt) return "stale";
  return "hit";
}

export function toCacheGetResult<T>(
  entry: ClientCacheEntry<T> | undefined,
  now = Date.now()
): ClientCacheGetResult<T> {
  if (!entry) return { status: "miss" };
  const status = classifyCacheFreshness(entry, now);
  if (status === "miss") return { status: "miss" };
  if (status === "stale") return { status: "stale", entry, stale: true };
  return { status: "hit", entry, stale: false };
}
