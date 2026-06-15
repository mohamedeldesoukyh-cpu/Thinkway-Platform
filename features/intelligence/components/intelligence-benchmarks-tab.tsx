import type { BenchmarkSliceRow } from "@/types/intelligence";

type Props = {
  rows: BenchmarkSliceRow[];
};

function formatUsd(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function IntelligenceBenchmarksTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Benchmark marts empty. ETL computes int_benchmarks from campaign lines by platform, category, market, and tier.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Platform</th>
              <th className="px-4 py-3 font-semibold">Market</th>
              <th className="px-4 py-3 font-semibold">Tier</th>
              <th className="px-4 py-3 font-semibold">Year</th>
              <th className="px-4 py-3 text-right font-semibold">Median cost</th>
              <th className="px-4 py-3 text-right font-semibold">P25 margin</th>
              <th className="px-4 py-3 text-right font-semibold">Median margin</th>
              <th className="px-4 py-3 text-right font-semibold">P75 margin</th>
              <th className="px-4 py-3 text-right font-semibold">n</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">{row.category ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.platform ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.market_entity ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.tier ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{row.period_year ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUsd(row.median_cost_usd)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.p25_margin_pct != null ? `${row.p25_margin_pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {row.median_margin_pct != null ? `${row.median_margin_pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.p75_margin_pct != null ? `${row.p75_margin_pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.sample_size}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
