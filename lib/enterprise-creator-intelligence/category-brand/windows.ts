import type { AnalysisWindowKey } from "@/lib/enterprise-creator-intelligence/category-brand/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function windowCutoffMs(
  window: AnalysisWindowKey,
  asOfMs: number
): number | null {
  switch (window) {
    case "last_30_days":
      return asOfMs - 30 * DAY_MS;
    case "last_90_days":
      return asOfMs - 90 * DAY_MS;
    case "last_180_days":
      return asOfMs - 180 * DAY_MS;
    case "lifetime":
      return null;
  }
}

export function isWithinWindow(
  postedAt: string | null | undefined,
  window: AnalysisWindowKey,
  asOfMs: number
): boolean {
  if (window === "lifetime") return true;
  if (!postedAt) return false;
  const t = new Date(postedAt).getTime();
  if (!Number.isFinite(t)) return false;
  const cutoff = windowCutoffMs(window, asOfMs);
  return cutoff == null ? true : t >= cutoff && t <= asOfMs;
}

export function windowDaySpan(window: AnalysisWindowKey): number {
  switch (window) {
    case "last_30_days":
      return 30;
    case "last_90_days":
      return 90;
    case "last_180_days":
      return 180;
    case "lifetime":
      return 365;
  }
}
