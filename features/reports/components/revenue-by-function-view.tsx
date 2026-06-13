"use client";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { RevenueByFunctionControls } from "@/features/reports/components/revenue-by-function-controls";
import type { RevenueByFunctionReportData } from "@/lib/analytics/revenue-by-function/revenue-by-function-types";

type Props = {
  report: RevenueByFunctionReportData;
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

export function RevenueByFunctionView({ report }: Props) {
  const hasReportData = report.rows.length > 0;

  return (
    <div className="space-y-4">
      <RevenueByFunctionControls report={report} />

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Revenue by function — {report.period_label} {report.year}
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.function_filter_label} · {report.user_filter_label} ·{" "}
              {report.client_type_label} clients in {report.display_currency}.
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
                No revenue data for this scope
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                Try another year, period, function, or user filter, or confirm campaigns have an
                account manager and active, paused, or completed status with billable lines.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-[640px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-left font-semibold">User</th>
                    <th className="px-4 py-2 text-left font-semibold">Function</th>
                    <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                    <th className="px-4 py-2 text-right font-semibold">GP</th>
                    <th className="px-4 py-2 text-right font-semibold">GP %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr
                      key={row.user_id ?? row.user_name}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {row.user_name}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.business_function_label}
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
                  {report.summary_rows.map((row) => (
                    <tr
                      key={row.user_name}
                      className="border-t border-border/70 bg-muted/20 font-medium"
                    >
                      <td className="px-4 py-2.5 text-foreground">{row.user_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.business_function_label}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatAmount(row.revenue)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatAmount(row.gp)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatGpPercent(row.gp_percent)}
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
