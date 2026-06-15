import { INTELLIGENCE_MARGIN_THRESHOLD } from "@/lib/intelligence/constants";
import type { MarginAlertRow } from "@/types/intelligence";

type Props = {
  rows: MarginAlertRow[];
};

function formatUsd(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function IntelligenceMarginTab({ rows }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Historical lines below {INTELLIGENCE_MARGIN_THRESHOLD}% margin (reference workflow threshold). Compare against live
        billable GP separately — historical data uses Rev − Cost only.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No sub-threshold margin lines in warehouse, or ETL has not run yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Campaign</th>
                  <th className="px-4 py-3 font-semibold">Brand</th>
                  <th className="px-4 py-3 font-semibold">Influencer</th>
                  <th className="px-4 py-3 font-semibold">Market</th>
                  <th className="px-4 py-3 font-semibold">Channel</th>
                  <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Margin</th>
                  <th className="px-4 py-3 font-semibold">Client type</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.campaign_name ?? row.source_line_id}</div>
                      <div className="text-xs text-muted-foreground">{row.period_year ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.brand_name_raw ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.influencer_name_raw ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.market_entity ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.channel ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatUsd(row.revenue_usd)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatUsd(row.cost_usd)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-amber-600 dark:text-amber-400">
                      {row.margin_pct != null ? `${row.margin_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.client_type_report ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
