"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { PnlReportControls } from "@/features/reports/components/pnl-report-controls";
import type {
  PnlClientRow,
  PnlComparisonReportData,
  PnlMetricKey,
} from "@/lib/analytics/pnl/pnl-report-types";
import { cn } from "@/lib/utils";

type DrilldownState = {
  metric: PnlMetricKey;
  metricLabel: string;
  year: number;
  periodKey: string;
  periodLabel: string;
} | null;

type Props = {
  report: PnlComparisonReportData;
};

const METRIC_LABELS: Record<PnlMetricKey, string> = {
  rev: "Revenue (deliverable)",
  ur_rev: "UR Rev",
  agency_fees: "Agency fees",
  total_revenue: "Total revenue",
  cost: "Cost",
  gp: "Gross profit",
  vr_refund: "VR refund",
  gp_after_vr: "GP after VR",
};

function isEmphasisRow(key: PnlMetricKey): boolean {
  return key === "gp" || key === "gp_after_vr";
}

const REVENUE_DETAIL_KEYS = new Set<PnlMetricKey>(["rev", "ur_rev", "agency_fees"]);

function RevenueExpandButton({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-border/70 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      aria-expanded={expanded}
    >
      {expanded ? <MinusIcon className="size-3" /> : <PlusIcon className="size-3" />}
    </button>
  );
}

function RevenueDetailExpandLink({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium transition-colors hover:underline",
        className
      )}
    >
      <PlusIcon className="size-2.5" />
      {label}
    </button>
  );
}

function revenueRowLabelClass(key: PnlMetricKey): string {
  if (key === "rev") return "pl-5 text-brand-blue";
  if (key === "ur_rev") return "pl-5 text-violet-600 dark:text-violet-400";
  if (key === "agency_fees") return "pl-5 text-amber-700 dark:text-amber-400";
  if (key === "total_revenue") return "border-t border-border/50 pt-3 font-bold text-foreground";
  return "";
}

function breakdownKey(year: number, metric: PnlMetricKey, periodKey: string): string {
  return `${year}:${metric}:${periodKey}`;
}

function formatPnlAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatVariancePercent(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`;
}

/** Jan/Mar/… lighter; Feb/Apr/… slightly deeper for month-at-a-glance scanning. */
function monthBandClass(monthKey: string, isGpRow: boolean): string {
  const calendarMonth = Number(monthKey.split("-")[1] ?? 1);
  const isLightMonth = calendarMonth % 2 === 1;

  if (isGpRow) {
    return isLightMonth ? "bg-[#0b1327]" : "bg-[#101a34]";
  }

  return isLightMonth
    ? "bg-slate-50/95 dark:bg-slate-900/45"
    : "bg-slate-100 dark:bg-slate-800/55";
}

function MonthSpacerCell({ isGpRow }: { isGpRow?: boolean }) {
  return (
    <td
      aria-hidden
      className={cn(
        "w-3 min-w-3 max-w-3 border-0 p-0",
        isGpRow ? "bg-[#0A0F1E]" : "bg-background"
      )}
    />
  );
}

function MonthSpacerHeader() {
  return (
    <th aria-hidden className="w-3 min-w-3 max-w-3 border-0 bg-background p-0" />
  );
}

function AmountButton({
  value,
  onClick,
  className,
}: {
  value: number;
  onClick: () => void;
  className?: string;
}) {
  if (value === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-medium tabular-nums underline-offset-2 transition-colors hover:underline",
        className
      )}
    >
      {formatPnlAmount(value)}
    </button>
  );
}

export function PnlReportView({ report }: Props) {
  const [drilldown, setDrilldown] = useState<DrilldownState>(null);
  const [revenueDetailsExpanded, setRevenueDetailsExpanded] = useState({
    rev: false,
    ur_rev: false,
    agency_fees: false,
  });

  const anyRevenueDetailExpanded =
    revenueDetailsExpanded.rev ||
    revenueDetailsExpanded.ur_rev ||
    revenueDetailsExpanded.agency_fees;

  function toggleRevenueDetail(key: "rev" | "ur_rev" | "agency_fees") {
    setRevenueDetailsExpanded((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleAllRevenueDetails() {
    const next = !anyRevenueDetailExpanded;
    setRevenueDetailsExpanded({
      rev: next,
      ur_rev: next,
      agency_fees: next,
    });
  }

  const visibleMetricRows = useMemo(
    () =>
      report.metric_rows.filter((row) => {
        if (!REVENUE_DETAIL_KEYS.has(row.key)) return true;
        return revenueDetailsExpanded[row.key as "rev" | "ur_rev" | "agency_fees"];
      }),
    [report.metric_rows, revenueDetailsExpanded]
  );

  const hasReportData = useMemo(
    () =>
      report.metric_rows.some(
        (row) => row.total.current > 0 || row.total.prior > 0 || Object.values(row.cells).some(
          (cell) => cell.current > 0 || cell.prior > 0
        )
      ),
    [report.metric_rows]
  );

  const drilldownRows = useMemo(() => {
    if (!drilldown) return [];
    return (
      report.client_breakdowns[
        breakdownKey(drilldown.year, drilldown.metric, drilldown.periodKey)
      ] ?? []
    );
  }, [drilldown, report.client_breakdowns]);

  function openDrilldown(input: DrilldownState & { amount: number }) {
    if (!input || input.amount === 0) return;
    setDrilldown({
      metric: input.metric,
      metricLabel: input.metricLabel,
      year: input.year,
      periodKey: input.periodKey,
      periodLabel: input.periodLabel,
    });
  }

  return (
    <div className="space-y-4">
      <PnlReportControls report={report} />

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                P&amp;L — {report.period_label} {report.current_year} vs {report.prior_year}
              </h2>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {report.period_note}
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {report.data_scope_note}
              </p>
            </div>
          </div>

          {!hasReportData ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No P&amp;L data for this scope</p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                Try another year or period, or confirm campaigns are <strong>active</strong>,{" "}
                <strong>paused</strong>, or <strong>completed</strong> with assignment lines that
                have revenue/cost. Campaigns still in <strong>draft</strong> are excluded until
                they go live.
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="min-w-[1100px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/25">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-10 min-w-[10rem] border-r border-border/60 bg-muted/25 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    P&amp;L
                  </th>
                  {report.columns.map((column, monthIndex) => (
                    <Fragment key={column.key}>
                      {monthIndex > 0 ? <MonthSpacerHeader /> : null}
                      <th
                        colSpan={4}
                        className={cn(
                          "border-l border-border/50 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-foreground",
                          monthBandClass(column.monthKey as string, false)
                        )}
                      >
                        {column.label}
                      </th>
                    </Fragment>
                  ))}
                  <MonthSpacerHeader />
                  <th
                    colSpan={4}
                    className="border-l border-border/60 bg-muted/35 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-foreground"
                  >
                    Total
                  </th>
                </tr>
                <tr className="border-b border-border/70 bg-muted/15 text-[10px] font-semibold uppercase tracking-wide">
                  {report.columns.map((column, monthIndex) => (
                    <Fragment key={`sub-${column.key}`}>
                      {monthIndex > 0 ? <MonthSpacerHeader /> : null}
                      <ColumnSubHeaders
                        currentYear={report.current_year}
                        priorYear={report.prior_year}
                        monthKey={column.monthKey as string}
                      />
                    </Fragment>
                  ))}
                  <MonthSpacerHeader />
                  <ColumnSubHeaders
                    currentYear={report.current_year}
                    priorYear={report.prior_year}
                    total
                  />
                </tr>
              </thead>
              <tbody>
                {visibleMetricRows.map((row) => {
                  const isGpRow = isEmphasisRow(row.key);
                  const isRevenueDetail = REVENUE_DETAIL_KEYS.has(row.key);
                  const isRevenueDetailExpanded = isRevenueDetail
                    ? revenueDetailsExpanded[row.key as "rev" | "ur_rev" | "agency_fees"]
                    : false;
                  const isRevenueSectionStart =
                    row.section === "revenue" &&
                    (anyRevenueDetailExpanded ? row.key === "rev" : row.key === "total_revenue");
                  const isVrSectionStart = row.section === "vr" && row.key === "vr_refund";
                  return (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      isRevenueSectionStart && "border-t-2 border-t-brand/20",
                      isVrSectionStart && "border-t-2 border-t-brand/25",
                      isGpRow ? "bg-[#0A0F1E] text-white" : "bg-card"
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-r border-border/60 px-4 py-2.5 text-sm font-semibold",
                        isGpRow ? "bg-[#0A0F1E]" : "bg-card",
                        revenueRowLabelClass(row.key)
                      )}
                    >
                      {row.key === "total_revenue" ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <RevenueExpandButton
                              expanded={anyRevenueDetailExpanded}
                              onToggle={toggleAllRevenueDetails}
                              label="all revenue details"
                            />
                            {isRevenueSectionStart ? (
                              <div className="space-y-0.5">
                                <span className="block text-[9px] font-semibold uppercase tracking-wider text-brand">
                                  Revenue
                                </span>
                                <span>{row.label}</span>
                              </div>
                            ) : (
                              <span>{row.label}</span>
                            )}
                          </div>
                          {!anyRevenueDetailExpanded ? (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
                              <RevenueDetailExpandLink
                                label="Rev"
                                className="text-brand-blue"
                                onClick={() => toggleRevenueDetail("rev")}
                              />
                              <RevenueDetailExpandLink
                                label="UR Rev"
                                className="text-violet-600 dark:text-violet-400"
                                onClick={() => toggleRevenueDetail("ur_rev")}
                              />
                              <RevenueDetailExpandLink
                                label="AF"
                                className="text-amber-700 dark:text-amber-400"
                                onClick={() => toggleRevenueDetail("agency_fees")}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : isRevenueDetail ? (
                        <div className="flex items-center gap-1.5">
                          <RevenueExpandButton
                            expanded={isRevenueDetailExpanded}
                            onToggle={() =>
                              toggleRevenueDetail(
                                row.key as "rev" | "ur_rev" | "agency_fees"
                              )
                            }
                            label={row.label}
                          />
                          {isRevenueSectionStart ? (
                            <div className="space-y-0.5">
                              <span className="block text-[9px] font-semibold uppercase tracking-wider text-brand">
                                Revenue
                              </span>
                              <span>{row.label}</span>
                            </div>
                          ) : (
                            <span>{row.label}</span>
                          )}
                        </div>
                      ) : isRevenueSectionStart ? (
                        <div className="space-y-0.5">
                          <span className="block text-[9px] font-semibold uppercase tracking-wider text-brand">
                            Revenue
                          </span>
                          <span>{row.label}</span>
                        </div>
                      ) : isVrSectionStart ? (
                        <div className="space-y-0.5">
                          <span className="block text-[9px] font-semibold uppercase tracking-wider text-brand">
                            VR
                          </span>
                          <span>{row.label}</span>
                        </div>
                      ) : (
                        row.label
                      )}
                    </td>
                    {report.columns.map((column, monthIndex) => {
                      const cell = row.cells[column.key]!;
                      return (
                        <Fragment key={`${row.key}-${column.key}`}>
                          {monthIndex > 0 ? <MonthSpacerCell isGpRow={isGpRow} /> : null}
                          <ComparisonCells
                            cell={cell}
                            isGpRow={isGpRow}
                            metricKey={row.key}
                            monthKey={column.monthKey as string}
                            onCurrent={() =>
                              openDrilldown({
                                metric: row.key,
                                metricLabel: row.label,
                                year: report.current_year,
                                periodKey: column.monthKey,
                                periodLabel: `${column.label} ${report.current_year}`,
                                amount: cell.current,
                              })
                            }
                            onPrior={() =>
                              openDrilldown({
                                metric: row.key,
                                metricLabel: row.label,
                                year: report.prior_year,
                                periodKey: column.monthKey,
                                periodLabel: `${column.label} ${report.prior_year}`,
                                amount: cell.prior,
                              })
                            }
                          />
                        </Fragment>
                      );
                    })}
                    <MonthSpacerCell isGpRow={isGpRow} />
                    <ComparisonCells
                      cell={row.total}
                      isGpRow={isGpRow}
                      metricKey={row.key}
                      total
                      onCurrent={() =>
                        openDrilldown({
                          metric: row.key,
                          metricLabel: row.label,
                          year: report.current_year,
                          periodKey: "total",
                          periodLabel: `${report.period_label} ${report.current_year}`,
                          amount: row.total.current,
                        })
                      }
                      onPrior={() =>
                        openDrilldown({
                          metric: row.key,
                          metricLabel: row.label,
                          year: report.prior_year,
                          periodKey: "total",
                          periodLabel: `${report.period_label} ${report.prior_year}`,
                          amount: row.total.prior,
                        })
                      }
                    />
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {drilldown ? (
            <div className="rounded-xl border border-border/70 bg-muted/10">
              <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {METRIC_LABELS[drilldown.metric]} by client — {drilldown.periodLabel}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Client breakdown for {drilldown.metricLabel.toLowerCase()}. Select a legal
                    entity to open its workspace.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => setDrilldown(null)}
                  aria-label="Close breakdown"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
              <div className="overflow-x-auto px-4 py-3">
                {drilldownRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No client data for this period.</p>
                ) : (
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Client</th>
                        <th className="py-2 pr-3 text-right font-medium">Rev</th>
                        <th className="py-2 pr-3 text-right font-medium">UR Rev</th>
                        <th className="py-2 pr-3 text-right font-medium">AF</th>
                        <th className="py-2 pr-3 text-right font-medium">Total Rev</th>
                        <th className="py-2 pr-3 text-right font-medium">Cost</th>
                        <th className="py-2 pr-3 text-right font-medium">GP</th>
                        <th className="py-2 pr-3 text-right font-medium">VR Refund</th>
                        <th className="py-2 pr-3 text-right font-medium">GP after VR</th>
                        <th className="py-2 text-right font-medium">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownRows.map((client) => (
                        <ClientDrilldownRow
                          key={client.client_id}
                          client={client}
                          highlight={drilldown.metric}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </OperationalTableSection>
    </div>
  );
}

function ColumnSubHeaders({
  currentYear,
  priorYear,
  monthKey,
  total = false,
}: {
  currentYear: number;
  priorYear: number;
  monthKey?: string;
  total?: boolean;
}) {
  const border = total ? "border-l border-border/60" : "border-l border-border/40";
  const band = total ? "bg-muted/35" : monthBandClass(monthKey ?? "2000-01", false);
  return (
    <>
      <th className={cn(border, band, "px-2 py-1.5 text-center text-brand-blue")}>
        {currentYear}
      </th>
      <th className={cn(band, "px-2 py-1.5 text-center text-emerald-700 dark:text-emerald-400")}>
        {priorYear}
      </th>
      <th className={cn(band, "px-2 py-1.5 text-center text-muted-foreground")}>Var $</th>
      <th className={cn(band, "px-2 py-1.5 text-center text-muted-foreground")}>Var %</th>
    </>
  );
}

function amountColorClass(metricKey: PnlMetricKey, side: "current" | "prior"): string {
  if (metricKey === "rev") {
    return side === "current"
      ? "text-brand-blue hover:text-brand-blue/80"
      : "text-brand-blue/80 hover:text-brand-blue/70";
  }
  if (metricKey === "ur_rev") {
    return side === "current"
      ? "text-violet-600 hover:text-violet-500 dark:text-violet-400"
      : "text-violet-500 hover:text-violet-400 dark:text-violet-400/90";
  }
  if (metricKey === "agency_fees") {
    return side === "current"
      ? "text-amber-700 hover:text-amber-600 dark:text-amber-400"
      : "text-amber-600 hover:text-amber-500 dark:text-amber-400/90";
  }
  if (metricKey === "vr_refund") {
    return side === "current"
      ? "text-teal-700 hover:text-teal-600 dark:text-teal-400"
      : "text-teal-600 hover:text-teal-500 dark:text-teal-400/90";
  }
  if (metricKey === "total_revenue") {
    return side === "current"
      ? "font-semibold text-foreground hover:text-foreground/80"
      : "font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-400";
  }
  return side === "current"
    ? "text-brand-blue hover:text-brand-blue/80"
    : "text-emerald-700 hover:text-emerald-600 dark:text-emerald-400";
}

function ComparisonCells({
  cell,
  isGpRow,
  metricKey,
  monthKey,
  total = false,
  onCurrent,
  onPrior,
}: {
  cell: {
    current: number;
    prior: number;
    variance_amount: number;
    variance_percent: number | null;
  };
  isGpRow: boolean;
  metricKey: PnlMetricKey;
  monthKey?: string;
  total?: boolean;
  onCurrent: () => void;
  onPrior: () => void;
}) {
  const muted = isGpRow ? "text-white/60" : "text-muted-foreground";
  const currentClass = isGpRow
    ? "text-white hover:text-white/90"
    : amountColorClass(metricKey, "current");
  const priorClass = isGpRow
    ? "text-white/90 hover:text-white"
    : amountColorClass(metricKey, "prior");
  const band = total
    ? isGpRow
      ? "bg-[#0A0F1E]"
      : "bg-muted/35"
    : monthBandClass(monthKey ?? "2000-01", isGpRow);
  const leftBorder = total ? "border-l border-border/60" : "border-l border-border/40";

  return (
    <>
      <td className={cn(leftBorder, band, "px-2 py-2.5 text-center tabular-nums")}>
        <AmountButton
          value={cell.current}
          onClick={onCurrent}
          className={currentClass}
        />
      </td>
      <td className={cn(band, "px-2 py-2.5 text-center tabular-nums")}>
        <AmountButton
          value={cell.prior}
          onClick={onPrior}
          className={priorClass}
        />
      </td>
      <td className={cn(band, "px-2 py-2.5 text-center tabular-nums", muted)}>
        {cell.variance_amount === 0 ? "—" : formatPnlAmount(cell.variance_amount)}
      </td>
      <td className={cn(band, "px-2 py-2.5 text-center tabular-nums font-medium", muted)}>
        {formatVariancePercent(cell.variance_percent)}
      </td>
    </>
  );
}

function ClientDrilldownRow({
  client,
  highlight,
}: {
  client: PnlClientRow;
  highlight: PnlMetricKey;
}) {
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="py-2.5 pr-3">
        <Link
          href={`/clients/${client.client_id}`}
          className="font-medium text-foreground underline-offset-2 hover:text-brand-blue hover:underline"
        >
          {client.client_name}
        </Link>
        <div className="text-xs text-muted-foreground">{client.line_count} line(s)</div>
      </td>
      <td
        className={cn(
          "py-2.5 pr-3 text-right tabular-nums",
          highlight === "rev" && "font-semibold text-brand-blue"
        )}
      >
        {formatPnlAmount(client.revenue)}
      </td>
      <td
        className={cn(
          "py-2.5 pr-3 text-right tabular-nums",
          highlight === "ur_rev" && "font-semibold text-violet-600 dark:text-violet-400"
        )}
      >
        {formatPnlAmount(client.ur_rev)}
      </td>
      <td
        className={cn(
          "py-2.5 pr-3 text-right tabular-nums",
          highlight === "agency_fees" && "font-semibold text-amber-700 dark:text-amber-400"
        )}
      >
        {formatPnlAmount(client.agency_fees)}
      </td>
      <td
        className={cn(
          "py-2.5 pr-3 text-right tabular-nums",
          highlight === "total_revenue" && "font-semibold text-foreground"
        )}
      >
        {formatPnlAmount(client.billable_revenue)}
      </td>
      <td
        className={cn(
          "py-2.5 pr-3 text-right tabular-nums",
          highlight === "cost" && "font-semibold text-amber-700 dark:text-amber-400"
        )}
      >
        {formatPnlAmount(client.cost)}
      </td>
      <td
        className={cn(
          "py-2.5 pr-3 text-right tabular-nums",
          highlight === "gp" && "font-semibold text-emerald-700 dark:text-emerald-400"
        )}
      >
        {formatPnlAmount(client.gp)}
      </td>
      <td
        className={cn(
          "py-2.5 pr-3 text-right tabular-nums",
          highlight === "vr_refund" && "font-semibold text-teal-700 dark:text-teal-400"
        )}
      >
        {formatPnlAmount(client.vr_refund)}
      </td>
      <td
        className={cn(
          "py-2.5 pr-3 text-right tabular-nums",
          highlight === "gp_after_vr" && "font-semibold text-emerald-700 dark:text-emerald-400"
        )}
      >
        {formatPnlAmount(client.gp_after_vr)}
      </td>
      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
        {client.margin_percent.toFixed(1)}%
      </td>
    </tr>
  );
}
