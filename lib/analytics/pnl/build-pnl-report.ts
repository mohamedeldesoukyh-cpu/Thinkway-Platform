import { buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import { computeGpAfterVr } from "@/lib/analytics/pnl/vr-refund";
import {
  formatPnLMonthLabel,
  monthsForScope,
  periodScopeLabel,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import type {
  PnlClientRow,
  PnlComparisonCell,
  PnlComparisonMetricRow,
  PnlComparisonReportData,
  PnlLineFact,
  PnlMetricKey,
  PnlPeriodColumn,
} from "@/lib/analytics/pnl/pnl-report-types";

function breakdownKey(year: number, metric: PnlMetricKey, periodKey: string | "total"): string {
  return `${year}:${metric}:${periodKey}`;
}

function buildClientBreakdown(
  facts: PnlLineFact[],
  metric: PnlMetricKey,
  periodKey: string | "total",
  scopeMonths: string[]
): PnlClientRow[] {
  const filtered =
    periodKey === "total"
      ? facts.filter((fact) => fact.period_month && scopeMonths.includes(fact.period_month))
      : facts.filter((fact) => fact.period_month === periodKey);

  const byClient = new Map<
    string,
    {
      client_name: string;
      revenue: number;
      ur_rev: number;
      agency_fees: number;
      cost: number;
      gp: number;
      vr_refund: number;
      gp_after_vr: number;
      line_count: number;
    }
  >();

  for (const fact of filtered) {
    const bucket =
      byClient.get(fact.client_id) ??
      {
        client_name: fact.client_name,
        revenue: 0,
        ur_rev: 0,
        agency_fees: 0,
        cost: 0,
        gp: 0,
        vr_refund: 0,
        gp_after_vr: 0,
        line_count: 0,
      };
    bucket.revenue = roundMoney(bucket.revenue + fact.revenue);
    bucket.ur_rev = roundMoney(bucket.ur_rev + fact.ur_rev);
    bucket.agency_fees = roundMoney(bucket.agency_fees + fact.agency_fees);
    bucket.cost = roundMoney(bucket.cost + fact.cost);
    bucket.gp = roundMoney(bucket.gp + fact.gp);
    bucket.vr_refund = roundMoney(bucket.vr_refund + fact.vr_refund);
    bucket.gp_after_vr = roundMoney(bucket.gp_after_vr + fact.gp_after_vr);
    bucket.line_count += 1;
    byClient.set(fact.client_id, bucket);
  }

  const rows: PnlClientRow[] = [...byClient.entries()].map(([client_id, row]) => {
    const billableBase = roundMoney(row.revenue + row.ur_rev + row.agency_fees);
    return {
      client_id,
      client_name: row.client_name,
      revenue: row.revenue,
      ur_rev: row.ur_rev,
      agency_fees: row.agency_fees,
      billable_revenue: billableBase,
      cost: row.cost,
      gp: row.gp,
      vr_refund: row.vr_refund,
      gp_after_vr: computeGpAfterVr(row.gp, row.vr_refund),
      margin_percent: computeMarginPercent(billableBase, computeGpAfterVr(row.gp, row.vr_refund)),
      line_count: row.line_count,
    };
  });

  const sortKey =
    metric === "rev"
      ? "revenue"
      : metric === "ur_rev"
        ? "ur_rev"
        : metric === "agency_fees"
          ? "agency_fees"
          : metric === "total_revenue"
            ? "billable_revenue"
            : metric === "cost"
              ? "cost"
              : metric === "vr_refund"
                ? "vr_refund"
                : metric === "gp_after_vr"
                  ? "gp_after_vr"
                  : "gp";

  return rows.sort((a, b) => b[sortKey] - a[sortKey]);
}

function billableRevenue(fact: PnlLineFact): number {
  return roundMoney(fact.revenue + fact.ur_rev + fact.agency_fees);
}

function metricValue(fact: PnlLineFact, metric: PnlMetricKey): number {
  if (metric === "rev") return fact.revenue;
  if (metric === "ur_rev") return fact.ur_rev;
  if (metric === "agency_fees") return fact.agency_fees;
  if (metric === "total_revenue") return billableRevenue(fact);
  if (metric === "cost") return fact.cost;
  if (metric === "vr_refund") return fact.vr_refund;
  if (metric === "gp_after_vr") return fact.gp_after_vr;
  return fact.gp;
}

function metricTotal(facts: PnlLineFact[], metric: PnlMetricKey, scopeMonths: string[]): number {
  const filtered = facts.filter(
    (fact) => fact.period_month && scopeMonths.includes(fact.period_month)
  );
  return roundMoney(
    filtered.reduce((sum, fact) => sum + metricValue(fact, metric), 0)
  );
}

function metricForMonth(
  facts: PnlLineFact[],
  metric: PnlMetricKey,
  monthKey: string
): number {
  return roundMoney(
    facts
      .filter((fact) => fact.period_month === monthKey)
      .reduce((sum, fact) => sum + metricValue(fact, metric), 0)
  );
}

function comparisonCell(current: number, prior: number): PnlComparisonCell {
  const variance_amount = roundMoney(current - prior);
  const variance_percent =
    prior === 0 ? (current === 0 ? 0 : null) : roundMoney((variance_amount / prior) * 100);
  return {
    current,
    prior,
    variance_amount,
    variance_percent,
  };
}

export function buildPnLComparisonReport(
  lineFacts: PnlLineFact[],
  currentYear: number,
  priorYear: number,
  periodScope: PnlPeriodScope,
  displayCurrency: string,
  availableCurrencies: string[]
): PnlComparisonReportData {
  const currentMonths = monthsForScope(currentYear, periodScope);
  const priorMonths = monthsForScope(priorYear, periodScope);

  const currentFacts = lineFacts.filter((fact) =>
    fact.period_month?.startsWith(String(currentYear))
  );
  const priorFacts = lineFacts.filter((fact) =>
    fact.period_month?.startsWith(String(priorYear))
  );

  const columns: PnlPeriodColumn[] = currentMonths.map((monthKey, index) => ({
    key: monthKey,
    label: formatPnLMonthLabel(monthKey),
    monthKey,
  }));

  const metricDefs: Array<{ key: PnlMetricKey; label: string; section?: "revenue" | "vr" }> = [
    { key: "rev", label: "Rev", section: "revenue" },
    { key: "ur_rev", label: "UR Rev", section: "revenue" },
    { key: "agency_fees", label: "AF", section: "revenue" },
    { key: "total_revenue", label: "Total Revenue", section: "revenue" },
    { key: "cost", label: "Total COGS" },
    { key: "gp", label: "Total Gross Profit" },
    { key: "vr_refund", label: "VR Refund", section: "vr" },
    { key: "gp_after_vr", label: "GP after VR", section: "vr" },
  ];

  const metric_rows: PnlComparisonMetricRow[] = metricDefs.map((def) => {
    const cells: Record<string, PnlComparisonCell> = {};
    for (let index = 0; index < currentMonths.length; index += 1) {
      const currentMonth = currentMonths[index]!;
      const priorMonth = priorMonths[index]!;
      cells[currentMonth] = comparisonCell(
        metricForMonth(currentFacts, def.key, currentMonth),
        metricForMonth(priorFacts, def.key, priorMonth)
      );
    }
    const total = comparisonCell(
      metricTotal(currentFacts, def.key, currentMonths),
      metricTotal(priorFacts, def.key, priorMonths)
    );
    return {
      key: def.key,
      label: def.label,
      section: def.section,
      cells,
      total,
    };
  });

  const client_breakdowns: Record<string, PnlClientRow[]> = {};
  const years = [
    { year: currentYear, facts: currentFacts, months: currentMonths },
    { year: priorYear, facts: priorFacts, months: priorMonths },
  ];

  for (const { year, facts, months } of years) {
    for (const def of metricDefs) {
      for (const month of months) {
        client_breakdowns[breakdownKey(year, def.key, month)] = buildClientBreakdown(
          facts,
          def.key,
          month,
          months
        );
      }
      client_breakdowns[breakdownKey(year, def.key, "total")] = buildClientBreakdown(
        facts,
        def.key,
        "total",
        months
      );
    }
  }

  return {
    current_year: currentYear,
    prior_year: priorYear,
    period_scope: periodScope,
    period_label: periodScopeLabel(periodScope),
    display_currency: displayCurrency,
    available_currencies: availableCurrencies,
    client_type: "all",
    client_type_label: "All",
    columns,
    metric_rows,
    currency: buildCurrencyContext([displayCurrency]),
    client_breakdowns,
    period_note:
      `All amounts shown in ${displayCurrency} using effective exchange rates. Grouped by campaign start month. Click any figure for client breakdown.`,
    data_scope_note:
      "Includes active, paused, and completed campaigns only. Cancelled campaigns and lines are excluded. Total revenue includes deliverable revenue, UR, and agency fees. Total COGS includes vendor cost, UR cost, and VR refund. Total GP is before VR; GP after VR deducts the VR refund. VR% uses the brand's current rate. Months use campaign start date, or created date when start is unset.",
  };
}

export { formatPnLMonthLabel } from "@/lib/analytics/pnl/pnl-periods";
