import {
  formatPnLMonthLabel,
  monthsForScope,
  parsePnlPeriodScope,
  parsePnlYear,
  periodScopeLabel,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";

import type {
  DailyReportLayout,
  DailyReportViewMode,
} from "@/lib/analytics/daily/daily-report-types";

export const DAILY_PERIOD_OPTIONS: Array<{ value: PnlPeriodScope; label: string }> = [
  { value: "q1", label: "Q1" },
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
  { value: "q4", label: "Q4" },
  { value: "h1", label: "H1" },
  { value: "h2", label: "H2" },
];

export const DAILY_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  const monthKey = `2000-${String(month).padStart(2, "0")}`;
  return {
    value: month,
    label: formatPnLMonthLabel(monthKey),
  };
});

export function parseDailyReportViewMode(value: string | undefined): DailyReportViewMode {
  return value === "period" ? "period" : "month";
}

export function parseDailyReportLayout(value: string | undefined): DailyReportLayout {
  return value === "columns" ? "columns" : "stacked";
}

export function parseDailyReportMonth(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) {
    return fallback;
  }
  return parsed;
}

export function parseDailyReportPeriod(value: string | undefined): PnlPeriodScope {
  const scope = parsePnlPeriodScope(value);
  if (scope === "fy") return "q1";
  return scope;
}

export { parsePnlYear as parseDailyReportYear };

export function monthKeyFor(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatDailyMonthTitle(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function resolveDailyReportMonthKeys(input: {
  year: number;
  viewMode: DailyReportViewMode;
  month: number;
  period: PnlPeriodScope;
}): string[] {
  if (input.viewMode === "month") {
    return [monthKeyFor(input.year, input.month)];
  }
  return monthsForScope(input.year, input.period);
}

export function resolveDailyReportPeriodLabel(input: {
  viewMode: DailyReportViewMode;
  year: number;
  month: number;
  period: PnlPeriodScope;
}): string {
  if (input.viewMode === "month") {
    return formatDailyMonthTitle(monthKeyFor(input.year, input.month));
  }
  return `${periodScopeLabel(input.period)} ${input.year}`;
}
