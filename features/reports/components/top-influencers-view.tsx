"use client";

import Link from "next/link";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { TopInfluencersControls } from "@/features/reports/components/top-influencers-controls";
import type { TopInfluencersReportData } from "@/lib/analytics/top-influencers/top-influencers-types";

type Props = {
  report: TopInfluencersReportData;
};

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatGpPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function TopInfluencersView({ report }: Props) {
  const hasReportData = report.rows.length > 0;

  return (
    <div className="space-y-4">
      <TopInfluencersControls report={report} />

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Top {report.limit} influencers — {report.period_label} {report.year}
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Ranked by {report.metric_label} ({report.client_type_label} clients) in{" "}
              {report.display_currency}.
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.period_note}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.data_scope_note}
            </p>
          </div>

          {!hasReportData ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                No influencer data for this scope
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                Try another year, period, or client type filter, or confirm campaigns are active,
                paused, or completed with vendor assignments that have cost and revenue.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-[720px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="w-12 px-3 py-2 text-center font-semibold">#</th>
                    <th className="px-4 py-2 text-left font-semibold">Influencer name</th>
                    <th className="px-4 py-2 text-left font-semibold">Code</th>
                    <th className="px-4 py-2 text-right font-semibold">Spending</th>
                    <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                    <th className="px-4 py-2 text-right font-semibold">GP</th>
                    <th className="px-4 py-2 text-right font-semibold">GP %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr
                      key={row.influencer_id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                        {row.rank}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/vendors/${row.influencer_id}`}
                          className="font-medium text-foreground underline-offset-2 hover:text-brand-blue hover:underline"
                        >
                          {row.influencer_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {row.document_number || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {row.spending === 0 ? "—" : formatAmount(row.spending)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {row.revenue === 0 ? "—" : formatAmount(row.revenue)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                        {row.gp === 0 ? "—" : formatAmount(row.gp)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.revenue === 0 && row.gp === 0
                          ? "—"
                          : formatGpPercent(row.gp_percent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </OperationalTableSection>
    </div>
  );
}
