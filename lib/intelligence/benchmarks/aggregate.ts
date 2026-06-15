export type PercentileResult = {
  p25: number | null;
  median: number | null;
  p75: number | null;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 100) / 100;
}

export function computePercentiles(values: number[]): PercentileResult {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return {
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
  };
}

export type BenchmarkInputRow = {
  platform: string | null;
  category: string | null;
  market_entity: string | null;
  tier: string | null;
  period_year: number | null;
  cost_usd: number | null;
  revenue_usd: number | null;
  margin_pct: number | null;
};

export type BenchmarkAggregate = {
  benchmark_key: string;
  period_year: number | null;
  median_cost_usd: number | null;
  p25_cost_usd: number | null;
  p75_cost_usd: number | null;
  median_revenue_usd: number | null;
  median_margin_pct: number | null;
  p25_margin_pct: number | null;
  p75_margin_pct: number | null;
  sample_size: number;
  dimensions: Record<string, string | number | null>;
};

function dimensionKey(parts: Record<string, string | number | null>): string {
  return Object.entries(parts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v ?? ""}`)
    .join("|");
}

export function buildBenchmarkAggregates(rows: BenchmarkInputRow[]): BenchmarkAggregate[] {
  const groups = new Map<string, BenchmarkInputRow[]>();

  for (const row of rows) {
    const dimensions = {
      platform: row.platform ?? "Unknown",
      category: row.category ?? "Unknown",
      market_entity: row.market_entity ?? "Unknown",
      tier: row.tier ?? "Unknown",
    };
    const key = dimensionKey({ ...dimensions, year: row.period_year ?? 0 });
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const aggregates: BenchmarkAggregate[] = [];
  for (const [benchmark_key, bucket] of groups) {
    const costs = bucket.map((r) => r.cost_usd).filter((v): v is number => v != null && v > 0);
    const revenues = bucket.map((r) => r.revenue_usd).filter((v): v is number => v != null && v > 0);
    const margins = bucket.map((r) => r.margin_pct).filter((v): v is number => v != null);

    const costPct = computePercentiles(costs);
    const marginPct = computePercentiles(margins);
    const sample = bucket[0];

    aggregates.push({
      benchmark_key,
      period_year: sample.period_year,
      median_cost_usd: costPct.median,
      p25_cost_usd: costPct.p25,
      p75_cost_usd: costPct.p75,
      median_revenue_usd: computePercentiles(revenues).median,
      median_margin_pct: marginPct.median,
      p25_margin_pct: marginPct.p25,
      p75_margin_pct: marginPct.p75,
      sample_size: bucket.length,
      dimensions: {
        platform: sample.platform,
        category: sample.category,
        market_entity: sample.market_entity,
        tier: sample.tier,
      },
    });
  }

  return aggregates;
}
