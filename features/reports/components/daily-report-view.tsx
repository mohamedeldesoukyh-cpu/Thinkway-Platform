"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DailyReportControls } from "@/features/reports/components/daily-report-controls";
import type {
  DailyDrilldownData,
  DailyDrilldownMetric,
  DailyDrilldownRowType,
  DailyReportData,
  DailyReportMonthTable,
} from "@/lib/analytics/daily/daily-report-types";
import { cn } from "@/lib/utils";

type Props = {
  report: DailyReportData;
};

type DrilldownRequest = {
  monthKey: string;
  rowType: DailyDrilldownRowType;
  metric: DailyDrilldownMetric;
  date?: string;
  amount: number;
};

function formatAmount(value: number): string {
  if (value === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  if (value === 0) return "—";
  return `${value.toFixed(2)}%`;
}

function AmountButton({
  value,
  formatted,
  onClick,
  className,
}: {
  value: number;
  formatted: string;
  onClick: () => void;
  className?: string;
}) {
  if (value === 0) {
    return <span className="text-muted-foreground">{formatted}</span>;
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
      {formatted}
    </button>
  );
}

function DailyMonthTable({
  table,
  currency,
  compact = false,
  onDrilldown,
}: {
  table: DailyReportMonthTable;
  currency: string;
  compact?: boolean;
  onDrilldown: (request: DrilldownRequest) => void;
}) {
  const openDay = (
    row: DailyReportMonthTable["rows"][number],
    metric: DailyDrilldownMetric,
    amount: number
  ) => {
    onDrilldown({
      monthKey: table.month_key,
      rowType: "day",
      metric,
      date: row.date,
      amount,
    });
  };

  const openSummary = (
    rowType: Exclude<DailyDrilldownRowType, "day">,
    metric: DailyDrilldownMetric,
    amount: number
  ) => {
    onDrilldown({
      monthKey: table.month_key,
      rowType,
      metric,
      amount,
    });
  };

  return (
    <div className={cn("space-y-2", compact && "min-w-[640px] shrink-0")}>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        {table.month_label}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="min-w-[640px] w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                colSpan={2}
                className="border border-[#548235] bg-[#548235] px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white"
              >
                &nbsp;
              </th>
              <th
                colSpan={3}
                className="border border-border/70 bg-muted/50 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-foreground"
              >
                Thinkway · {currency}
              </th>
            </tr>
            <tr>
              <th className="border border-[#548235] bg-[#548235] px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white">
                Week
              </th>
              <th className="border border-[#548235] bg-[#548235] px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white">
                Date
              </th>
              <th className="border border-border/70 bg-muted/40 px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-foreground">
                Revenue
              </th>
              <th className="border border-border/70 bg-muted/40 px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-foreground">
                GP
              </th>
              <th className="border border-border/70 bg-muted/40 px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-foreground">
                GP %
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.date} className="hover:bg-muted/10">
                <td className="border border-border/50 px-3 py-1 text-xs font-medium text-[#548235]">
                  {row.week}
                </td>
                <td className="border border-border/50 px-3 py-1 text-xs">{row.date_label}</td>
                <td className="border border-border/50 px-3 py-1 text-right tabular-nums text-xs">
                  <AmountButton
                    value={row.revenue}
                    formatted={formatAmount(row.revenue)}
                    onClick={() => openDay(row, "revenue", row.revenue)}
                  />
                </td>
                <td className="border border-border/50 px-3 py-1 text-right tabular-nums text-xs">
                  <AmountButton
                    value={row.gp}
                    formatted={formatAmount(row.gp)}
                    onClick={() => openDay(row, "gp", row.gp)}
                  />
                </td>
                <td className="border border-border/50 px-3 py-1 text-right tabular-nums text-xs">
                  <AmountButton
                    value={row.gp_percent}
                    formatted={formatPercent(row.gp_percent)}
                    onClick={() => openDay(row, "gp_percent", row.gp_percent)}
                  />
                </td>
              </tr>
            ))}

            <SummaryRow
              label="Sub-Total"
              summary={table.subtotal}
              variant="total"
              onRevenue={() =>
                openSummary("subtotal", "revenue", table.subtotal.revenue)
              }
              onGp={() => openSummary("subtotal", "gp", table.subtotal.gp)}
              onGpPercent={() =>
                openSummary("subtotal", "gp_percent", table.subtotal.gp_percent)
              }
            />
            <SummaryRow
              label="Run Rate"
              summary={table.run_rate}
              variant="run-rate"
              onRevenue={() =>
                openSummary("run_rate", "revenue", table.run_rate.revenue)
              }
              onGp={() => openSummary("run_rate", "gp", table.run_rate.gp)}
              onGpPercent={() =>
                openSummary("run_rate", "gp_percent", table.run_rate.gp_percent)
              }
            />
            <tr className="italic text-red-600">
              <td
                colSpan={2}
                className="border border-border/50 px-3 py-1 text-xs font-semibold"
              >
                VR
              </td>
              <td className="border border-border/50 px-3 py-1 text-right text-xs">—</td>
              <td className="border border-border/50 px-3 py-1 text-right tabular-nums text-xs">
                <AmountButton
                  value={table.vr.gp}
                  formatted={formatAmount(table.vr.gp)}
                  onClick={() => openSummary("vr", "gp", table.vr.gp)}
                  className="text-red-600 hover:text-red-500"
                />
              </td>
              <td className="border border-border/50 px-3 py-1 text-right text-xs">—</td>
            </tr>
            <SummaryRow
              label="Total after VR"
              summary={table.total_after_vr}
              variant="total"
              onRevenue={() =>
                openSummary("total_after_vr", "revenue", table.total_after_vr.revenue)
              }
              onGp={() =>
                openSummary("total_after_vr", "gp", table.total_after_vr.gp)
              }
              onGpPercent={() =>
                openSummary(
                  "total_after_vr",
                  "gp_percent",
                  table.total_after_vr.gp_percent
                )
              }
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  summary,
  variant,
  onRevenue,
  onGp,
  onGpPercent,
}: {
  label: string;
  summary: { revenue: number; gp: number; gp_percent: number };
  variant: "total" | "run-rate";
  onRevenue: () => void;
  onGp: () => void;
  onGpPercent: () => void;
}) {
  const isTotal = variant === "total";
  const amountClass = isTotal
    ? "text-white hover:text-white/90"
    : "text-red-600 hover:text-red-500";

  return (
    <tr
      className={cn(
        isTotal
          ? "bg-[#548235] font-semibold text-white"
          : "italic text-red-600"
      )}
    >
      <td colSpan={2} className="border border-border/50 px-3 py-1 text-xs">
        {label}
      </td>
      <td className="border border-border/50 px-3 py-1 text-right tabular-nums text-xs">
        <AmountButton
          value={summary.revenue}
          formatted={formatAmount(summary.revenue)}
          onClick={onRevenue}
          className={amountClass}
        />
      </td>
      <td className="border border-border/50 px-3 py-1 text-right tabular-nums text-xs">
        <AmountButton
          value={summary.gp}
          formatted={formatAmount(summary.gp)}
          onClick={onGp}
          className={amountClass}
        />
      </td>
      <td className="border border-border/50 px-3 py-1 text-right tabular-nums text-xs">
        <AmountButton
          value={summary.gp_percent}
          formatted={formatPercent(summary.gp_percent)}
          onClick={onGpPercent}
          className={amountClass}
        />
      </td>
    </tr>
  );
}

function DailyDrilldownSheet({
  open,
  loading,
  data,
  error,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  data: DailyDrilldownData | null;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="left" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-4">
          <SheetTitle className="text-sm font-semibold">
            {data?.label ?? "Client breakdown"}
          </SheetTitle>
          <SheetDescription className="text-[11px]">
            Revenue, GP, and margin by legal entity for the selected scope.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading client breakdown…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !data || data.clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client data for this scope.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th
                    className={cn(
                      "py-2 pr-3 text-right font-medium",
                      data.metric === "revenue" && "text-foreground"
                    )}
                  >
                    Revenue
                  </th>
                  <th
                    className={cn(
                      "py-2 pr-3 text-right font-medium",
                      data.metric === "gp" && "text-foreground"
                    )}
                  >
                    GP
                  </th>
                  <th
                    className={cn(
                      "py-2 text-right font-medium",
                      data.metric === "gp_percent" && "text-foreground"
                    )}
                  >
                    GP %
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((client) => (
                  <tr key={client.client_id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/clients/${client.client_id}`}
                        className="font-medium text-foreground underline-offset-2 hover:text-brand-blue hover:underline"
                      >
                        {client.client_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {client.line_count} line(s)
                      </div>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 text-right tabular-nums",
                        data.metric === "revenue" && "font-semibold"
                      )}
                    >
                      {formatAmount(client.revenue)}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 text-right tabular-nums",
                        data.metric === "gp" && "font-semibold"
                      )}
                    >
                      {formatAmount(client.gp)}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 text-right tabular-nums",
                        data.metric === "gp_percent" && "font-semibold"
                      )}
                    >
                      {formatPercent(client.margin_percent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DailyReportView({ report }: Props) {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState<DailyDrilldownData | null>(null);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);

  const closeDrilldown = useCallback(() => {
    setDrilldownOpen(false);
    setDrilldownLoading(false);
    setDrilldownData(null);
    setDrilldownError(null);
  }, []);

  const openDrilldown = useCallback(
    async (request: DrilldownRequest) => {
      if (request.amount === 0) return;

      setDrilldownOpen(true);
      setDrilldownLoading(true);
      setDrilldownData(null);
      setDrilldownError(null);

      const params = new URLSearchParams({
        monthKey: request.monthKey,
        rowType: request.rowType,
        metric: request.metric,
        currency: report.display_currency,
      });
      if (request.date) {
        params.set("date", request.date);
      }
      if (report.client_type !== "all") {
        params.set("clientType", report.client_type);
      }

      try {
        const response = await fetch(`/api/reports/daily/drilldown?${params.toString()}`);
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to load client breakdown");
        }
        const payload = (await response.json()) as DailyDrilldownData;
        setDrilldownData(payload);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load client breakdown";
        setDrilldownError(message);
      } finally {
        setDrilldownLoading(false);
      }
    },
    [report.display_currency, report.client_type]
  );

  const columnsLayout = report.layout === "columns";

  return (
    <div className="space-y-4">
      <DailyReportControls report={report} />

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-6 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Daily report — {report.period_label}
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.data_scope_note}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Click any revenue, GP, or GP % figure for a client breakdown.
            </p>
          </div>

          {report.tables.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No data for this scope</p>
            </div>
          ) : columnsLayout ? (
            <div className="overflow-x-auto pb-2">
              <div className="flex w-max min-w-full gap-4">
                {report.tables.map((table) => (
                  <DailyMonthTable
                    key={table.month_key}
                    table={table}
                    currency={report.display_currency}
                    compact
                    onDrilldown={openDrilldown}
                  />
                ))}
              </div>
            </div>
          ) : (
            report.tables.map((table) => (
              <DailyMonthTable
                key={table.month_key}
                table={table}
                currency={report.display_currency}
                onDrilldown={openDrilldown}
              />
            ))
          )}
        </div>
      </OperationalTableSection>

      <DailyDrilldownSheet
        open={drilldownOpen}
        loading={drilldownLoading}
        data={drilldownData}
        error={drilldownError}
        onClose={closeDrilldown}
      />
    </div>
  );
}
