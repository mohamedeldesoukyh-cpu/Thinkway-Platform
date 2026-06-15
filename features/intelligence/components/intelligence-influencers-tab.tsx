import type { TopInfluencerIntelRow } from "@/types/intelligence";

type Props = {
  rows: TopInfluencerIntelRow[];
};

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function IntelligenceInfluencersTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No influencer facts yet. Run the ETL pipeline to populate int_influencers and int_campaigns.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Influencer</th>
              <th className="px-4 py-3 font-semibold">Platform</th>
              <th className="px-4 py-3 font-semibold">Country</th>
              <th className="px-4 py-3 font-semibold">Tier</th>
              <th className="px-4 py-3 text-right font-semibold">Lines</th>
              <th className="px-4 py-3 text-right font-semibold">Median cost</th>
              <th className="px-4 py-3 text-right font-semibold">Median margin</th>
              <th className="px-4 py-3 text-right font-semibold">Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.display_name_raw}</div>
                  {row.username ? (
                    <div className="text-xs text-muted-foreground">@{row.username}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.platform ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.country ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.tier ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.line_count}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.median_cost_usd > 0 ? formatUsd(row.median_cost_usd) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.median_margin_pct != null ? `${row.median_margin_pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {Math.round(row.match_confidence * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
