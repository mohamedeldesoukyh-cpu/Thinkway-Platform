import { roundMoney } from "@/lib/analytics/aggregations/round";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import type { DailyLineFact, DailyReportMonthTable } from "@/lib/analytics/daily/daily-report-types";

function weekOfMonth(day: number): string {
  return `W${Math.ceil(day / 7)}`;
}

function formatDayLabel(monthKey: string, day: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function isCurrentMonth(monthKey: string, reference: Date): boolean {
  const [year, month] = monthKey.split("-").map(Number);
  return reference.getFullYear() === year && reference.getMonth() + 1 === month;
}

function billableRevenue(fact: DailyLineFact): number {
  return roundMoney(fact.revenue + fact.ur_rev + fact.agency_fees);
}

function aggregateDayFacts(facts: DailyLineFact[]): {
  revenue: number;
  gp: number;
  vr_refund: number;
  gp_after_vr: number;
} {
  let revenue = 0;
  let gp = 0;
  let vr_refund = 0;
  let gp_after_vr = 0;

  for (const fact of facts) {
    revenue = roundMoney(revenue + billableRevenue(fact));
    gp = roundMoney(gp + fact.gp);
    vr_refund = roundMoney(vr_refund + fact.vr_refund);
    gp_after_vr = roundMoney(gp_after_vr + fact.gp_after_vr);
  }

  return { revenue, gp, vr_refund, gp_after_vr };
}

function buildSummary(revenue: number, gp: number) {
  return {
    revenue,
    gp,
    gp_percent: computeMarginPercent(revenue, gp),
  };
}

function computeRunRate(
  subtotal: { revenue: number; gp: number },
  monthKey: string,
  reference: Date
): { revenue: number; gp: number; gp_percent: number } {
  const totalDays = daysInMonth(monthKey);

  if (!isCurrentMonth(monthKey, reference)) {
    return buildSummary(subtotal.revenue, subtotal.gp);
  }

  const elapsedDays = Math.max(1, reference.getDate());
  const factor = totalDays / elapsedDays;

  return buildSummary(
    roundMoney(subtotal.revenue * factor),
    roundMoney(subtotal.gp * factor)
  );
}

export function buildDailyMonthTable(
  monthKey: string,
  monthLabel: string,
  facts: DailyLineFact[],
  reference: Date = new Date()
): DailyReportMonthTable {
  const totalDays = daysInMonth(monthKey);
  const factsByDate = new Map<string, DailyLineFact[]>();

  for (const fact of facts) {
    if (!fact.period_date.startsWith(monthKey)) continue;
    const bucket = factsByDate.get(fact.period_date) ?? [];
    bucket.push(fact);
    factsByDate.set(fact.period_date, bucket);
  }

  const rows = Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    const dayFacts = factsByDate.get(date) ?? [];
    const totals = aggregateDayFacts(dayFacts);

    return {
      week: weekOfMonth(day),
      date,
      date_label: formatDayLabel(monthKey, day),
      revenue: totals.revenue,
      gp: totals.gp,
      gp_percent: computeMarginPercent(totals.revenue, totals.gp),
    };
  });

  const monthFacts = facts.filter((fact) => fact.period_date.startsWith(monthKey));
  const subtotalAgg = aggregateDayFacts(monthFacts);
  const subtotal = buildSummary(subtotalAgg.revenue, subtotalAgg.gp);
  const run_rate = computeRunRate(subtotal, monthKey, reference);
  const total_after_vr = buildSummary(subtotalAgg.revenue, subtotalAgg.gp_after_vr);

  return {
    month_key: monthKey,
    month_label: monthLabel,
    rows,
    subtotal,
    run_rate,
    vr: { gp: subtotalAgg.vr_refund },
    total_after_vr: {
      ...total_after_vr,
      gp_percent: computeMarginPercent(total_after_vr.revenue, total_after_vr.gp),
    },
  };
}
