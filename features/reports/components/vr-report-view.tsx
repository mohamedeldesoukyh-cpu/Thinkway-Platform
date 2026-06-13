"use client";

import Link from "next/link";
import { Fragment } from "react";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { VrReportControls } from "@/features/reports/components/vr-report-controls";
import type { VrReportData } from "@/lib/analytics/vr-report/vr-report-types";
import { cn } from "@/lib/utils";

type Props = {
  report: VrReportData;
};

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatVrPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function monthBandClass(monthKey: string): string {
  const calendarMonth = Number(monthKey.split("-")[1] ?? 1);
  const isLightMonth = calendarMonth % 2 === 1;
  return isLightMonth
    ? "bg-slate-50/95 dark:bg-slate-900/45"
    : "bg-slate-100 dark:bg-slate-800/55";
}

function MonthSpacerCell() {
  return <td aria-hidden className="w-3 min-w-3 max-w-3 border-0 bg-background p-0" />;
}

function MonthSpacerHeader() {
  return <th aria-hidden className="w-3 min-w-3 max-w-3 border-0 bg-background p-0" />;
}

export function VrReportView({ report }: Props) {
  const hasReportData = report.rows.length > 0;

  return (
    <div className="space-y-4">
      <VrReportControls report={report} />

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              VR report — {report.period_label} {report.year}
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.period_note}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.data_scope_note}
            </p>
          </div>

          {!hasReportData ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No VR data for this scope</p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                Try another year or period, or confirm campaigns are active, paused, or completed
                with assignment lines that have revenue and cost.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-[960px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-10 min-w-[8rem] border-r border-border/60 bg-muted/25 px-4 py-2 text-left font-semibold">
                      Group
                    </th>
                    <th className="sticky left-[8rem] z-10 min-w-[10rem] border-r border-border/60 bg-muted/25 px-4 py-2 text-left font-semibold">
                      Client
                    </th>
                    <th className="min-w-[6rem] px-3 py-2 text-right font-semibold">Revenue</th>
                    <th className="min-w-[4.5rem] px-3 py-2 text-right font-semibold">VR %</th>
                    {report.columns.map((column, monthIndex) => (
                      <Fragment key={column.key}>
                        {monthIndex > 0 ? <MonthSpacerHeader /> : null}
                        <th
                          className={cn(
                            "min-w-[5rem] border-l border-border/50 px-2 py-2 text-center font-semibold text-foreground",
                            monthBandClass(column.monthKey)
                          )}
                        >
                          {column.label} VR
                        </th>
                      </Fragment>
                    ))}
                    <MonthSpacerHeader />
                    <th className="min-w-[5.5rem] border-l border-border/60 bg-muted/35 px-3 py-2 text-right font-semibold text-foreground">
                      Total VR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.client_id} className="border-b border-border/50 last:border-0">
                      <td className="sticky left-0 z-10 border-r border-border/60 bg-card px-4 py-2.5 text-sm text-muted-foreground">
                        {row.group_name}
                      </td>
                      <td className="sticky left-[8rem] z-10 border-r border-border/60 bg-card px-4 py-2.5">
                        <Link
                          href={`/clients/${row.client_id}`}
                          className="font-medium text-foreground underline-offset-2 hover:text-brand-blue hover:underline"
                        >
                          {row.client_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.revenue === 0 ? "—" : formatAmount(row.revenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatVrPercent(row.vr_rate_percent)}
                      </td>
                      {report.columns.map((column, monthIndex) => {
                        const value = row.monthly_vr[column.key] ?? 0;
                        return (
                          <Fragment key={`${row.client_id}-${column.key}`}>
                            {monthIndex > 0 ? <MonthSpacerCell /> : null}
                            <td
                              className={cn(
                                "border-l border-border/40 px-2 py-2.5 text-center tabular-nums text-teal-700 dark:text-teal-400",
                                monthBandClass(column.monthKey)
                              )}
                            >
                              {value === 0 ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                formatAmount(value)
                              )}
                            </td>
                          </Fragment>
                        );
                      })}
                      <MonthSpacerCell />
                      <td className="border-l border-border/60 bg-muted/20 px-3 py-2.5 text-right tabular-nums font-medium text-teal-700 dark:text-teal-400">
                        {row.total_vr === 0 ? "—" : formatAmount(row.total_vr)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border/70 bg-muted/15 font-semibold">
                    <td
                      colSpan={2}
                      className="sticky left-0 z-10 border-r border-border/60 bg-muted/15 px-4 py-2.5"
                    >
                      Total
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(report.totals.revenue)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      —
                    </td>
                    {report.columns.map((column, monthIndex) => {
                      const value = report.totals.monthly_vr[column.key] ?? 0;
                      return (
                        <Fragment key={`total-${column.key}`}>
                          {monthIndex > 0 ? <MonthSpacerCell /> : null}
                          <td
                            className={cn(
                              "border-l border-border/40 px-2 py-2.5 text-center tabular-nums",
                              monthBandClass(column.monthKey)
                            )}
                          >
                            {value === 0 ? "—" : formatAmount(value)}
                          </td>
                        </Fragment>
                      );
                    })}
                    <MonthSpacerCell />
                    <td className="border-l border-border/60 bg-muted/35 px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(report.totals.total_vr)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </OperationalTableSection>
    </div>
  );
}
