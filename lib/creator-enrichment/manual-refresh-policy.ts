/**
 * Manual refresh UX policy — when to prompt before spending Apify credits.
 *
 * Does not alter automatic enrichment, IPL TTL, or creator freshness windows.
 */

const HOUR_MS = 60 * 60 * 1000;

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Hours within which a manual refresh shows the cache-vs-live dialog. Default 24. */
export function getManualRefreshCachePromptThresholdHours(): number {
  return envNumber("MANUAL_REFRESH_CACHE_PROMPT_HOURS", 24);
}

export function getManualRefreshCachePromptThresholdMs(): number {
  return getManualRefreshCachePromptThresholdHours() * HOUR_MS;
}

export function isWithinManualRefreshPromptWindow(
  value: string | Date | null | undefined,
  now: number = Date.now()
): boolean {
  if (!value) return false;
  const ts = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(ts)) return false;
  return now - ts < getManualRefreshCachePromptThresholdMs();
}

export type ManualRefreshDataSource = "cached_snapshot" | "live_apify";

export function resolveManualRefreshDataSource(
  input: ManualRefreshDataSource | null | undefined
): ManualRefreshDataSource {
  return input === "cached_snapshot" ? "cached_snapshot" : "live_apify";
}

export function shouldPromptManualRefreshCache(input: {
  hasValidSnapshot: boolean;
  lastEnrichedAt: string | null;
  lastLiveFetchAt: string | null;
  now?: number;
}): boolean {
  if (!input.hasValidSnapshot) return false;
  const now = input.now ?? Date.now();
  return (
    isWithinManualRefreshPromptWindow(input.lastEnrichedAt, now) ||
    isWithinManualRefreshPromptWindow(input.lastLiveFetchAt, now)
  );
}
