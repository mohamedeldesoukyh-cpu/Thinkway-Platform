/**
 * IPL configuration — env overrides with safe defaults.
 */

/** Master switch. When false, enrichment bypasses IPL (backward compat escape hatch). */
export function isIplEnabled(): boolean {
  const flag = process.env.IPL_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

/** When true, skip external provider if a fresh IPL snapshot exists. */
export function isIplCacheFirstEnabled(): boolean {
  const flag = process.env.IPL_CACHE_FIRST?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

/** Default TTL days when no DB policy row exists. Matches ENRICHMENT_STALE_AFTER_DAYS. */
export const IPL_DEFAULT_TTL_DAYS = 30;

/** Fallback follower-tier overrides (days) when policy row has empty overrides. */
export const IPL_DEFAULT_FOLLOWER_TIER_OVERRIDES: Record<string, number> = {
  "500000": 7,
  "50000": 14,
};
