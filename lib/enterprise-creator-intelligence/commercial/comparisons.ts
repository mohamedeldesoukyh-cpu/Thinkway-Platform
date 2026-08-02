import type {
  CommercialComparisonWindows,
  CommercialMetricPoint,
} from "@/lib/enterprise-creator-intelligence/commercial/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function pointNear(
  series: CommercialMetricPoint[],
  asOfMs: number,
  windowDays: number
): number | null {
  const windowStart = asOfMs - windowDays * DAY_MS;
  const windowEnd = asOfMs - Math.max(1, windowDays - 15) * DAY_MS;
  const candidates = series.filter((p) => {
    const t = new Date(p.at).getTime();
    return Number.isFinite(t) && t >= windowStart && t <= windowEnd && p.value != null;
  });
  if (candidates.length === 0) {
    // Fallback: nearest point at or before the window end.
    const older = series
      .filter((p) => {
        const t = new Date(p.at).getTime();
        return Number.isFinite(t) && t <= windowEnd && p.value != null;
      })
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return older[0]?.value ?? null;
  }
  const values = candidates.map((c) => Number(c.value));
  return values.reduce((s, n) => s + n, 0) / values.length;
}

function lifetimeAverage(series: CommercialMetricPoint[]): number | null {
  const values = series
    .map((p) => p.value)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

/**
 * Comparison windows data model.
 * Values are derived from append-only historical series when present; otherwise null.
 */
export function buildComparisonWindows(input: {
  currentValue: number | null;
  series: CommercialMetricPoint[];
  asOf?: string | Date;
}): CommercialComparisonWindows {
  const asOfMs = new Date(input.asOf ?? Date.now()).getTime();
  const series = [...input.series].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  return {
    current: input.currentValue,
    previousMonth: pointNear(series, asOfMs, 30),
    previousQuarter: pointNear(series, asOfMs, 90),
    previousSixMonths: pointNear(series, asOfMs, 180),
    previousYear: pointNear(series, asOfMs, 365),
    lifetime: lifetimeAverage(series),
  };
}
