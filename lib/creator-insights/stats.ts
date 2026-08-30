import type { CreatorInsightConfidence } from "./types";
import { MIN_RELATIVE_DELTA } from "./types";

/** Average only real numbers. Missing values stay missing — never coerced to zero. */
export function meanOfPresent(values: ReadonlyArray<number | null | undefined>): number | null {
  const present = presentNumbers(values);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

export function medianOfPresent(values: ReadonlyArray<number | null | undefined>): number | null {
  const present = presentNumbers(values).sort((a, b) => a - b);
  if (present.length === 0) return null;
  const mid = Math.floor(present.length / 2);
  if (present.length % 2 === 1) return present[mid] ?? null;
  const a = present[mid - 1];
  const b = present[mid];
  if (a == null || b == null) return null;
  return (a + b) / 2;
}

export function presentNumbers(values: ReadonlyArray<number | null | undefined>): number[] {
  const out: number[] = [];
  for (const value of values) {
    if (value == null) continue;
    if (!Number.isFinite(value)) continue;
    out.push(value);
  }
  return out;
}

export function presentCount(values: ReadonlyArray<number | null | undefined>): number {
  return presentNumbers(values).length;
}

/** Relative change. Returns null when the baseline is missing or zero (no invented lift). */
export function percentChange(recent: number | null, baseline: number | null): number | null {
  if (recent == null || baseline == null) return null;
  if (!Number.isFinite(recent) || !Number.isFinite(baseline)) return null;
  if (baseline === 0) return null;
  return (recent - baseline) / baseline;
}

export function trendFromDelta(
  delta: number | null
): "up" | "down" | "flat" | null {
  if (delta == null) return null;
  if (delta >= MIN_RELATIVE_DELTA) return "up";
  if (delta <= -MIN_RELATIVE_DELTA) return "down";
  return "flat";
}

export function confidenceFromSampleAndDelta(
  sampleSize: number,
  absDelta: number | null
): CreatorInsightConfidence | null {
  if (absDelta == null || absDelta < MIN_RELATIVE_DELTA) return null;
  if (sampleSize >= 8 && absDelta >= 0.2) return "high";
  if (sampleSize >= 5) return "medium";
  if (sampleSize >= 3) return "low";
  return null;
}

export function formatMetricNumber(value: number, metricKey: string): string {
  if (metricKey === "engagementRate") {
    const asPercent = value <= 1 ? value * 100 : value;
    return `${asPercent.toFixed(1)}%`;
  }
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
      value
    );
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function metricNoun(metricKey: string): string {
  switch (metricKey) {
    case "views":
      return "views";
    case "reach":
      return "reach";
    case "impressions":
      return "impressions";
    case "likes":
      return "likes";
    case "comments":
      return "comments";
    case "shares":
      return "shares";
    case "saves":
      return "saves";
    case "engagementRate":
      return "engagement";
    default:
      return "performance";
  }
}
