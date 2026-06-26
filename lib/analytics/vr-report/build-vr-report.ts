import { formatGroupDisplayName } from "@/lib/groups/group-display";
import {
  formatPnLMonthLabel,
  monthsForScope,
  periodScopeLabel,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import type { PnlLineFact } from "@/lib/analytics/pnl/pnl-report-types";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import type {
  VrReportColumn,
  VrReportData,
  VrReportRow,
  VrReportTotals,
} from "@/lib/analytics/vr-report/vr-report-types";

function billableRevenue(fact: PnlLineFact): number {
  return roundMoney(fact.revenue + fact.ur_rev + fact.agency_fees);
}

function resolveGroupName(fact: PnlLineFact): string {
  return formatGroupDisplayName(fact.group_name);
}

function aggregateClientRows(
  facts: PnlLineFact[],
  scopeMonths: string[]
): VrReportRow[] {
  const filtered = facts.filter(
    (fact) => fact.period_month && scopeMonths.includes(fact.period_month)
  );

  const byClient = new Map<
    string,
    {
      client_name: string;
      group_id: string | null;
      group_name: string;
      revenue: number;
      vr_amount_sum: number;
      monthly_vr: Record<string, number>;
      total_vr: number;
    }
  >();

  for (const fact of filtered) {
    const billable = billableRevenue(fact);
    const monthKey = fact.period_month!;
    const bucket =
      byClient.get(fact.client_id) ??
      {
        client_name: fact.client_name,
        group_id: fact.group_id ?? null,
        group_name: resolveGroupName(fact),
        revenue: 0,
        vr_amount_sum: 0,
        monthly_vr: Object.fromEntries(scopeMonths.map((month) => [month, 0])),
        total_vr: 0,
      };

    bucket.revenue = roundMoney(bucket.revenue + billable);
    // Weighted client VR%: sum(spend × effective brand VR%) / total spend
    bucket.vr_amount_sum = roundMoney(
      bucket.vr_amount_sum + (billable * fact.vr_rate_percent) / 100
    );
    bucket.monthly_vr[monthKey] = roundMoney(
      (bucket.monthly_vr[monthKey] ?? 0) + fact.vr_refund
    );
    bucket.total_vr = roundMoney(bucket.total_vr + fact.vr_refund);

    if (!bucket.group_name || bucket.group_name === formatGroupDisplayName(null)) {
      bucket.group_name = resolveGroupName(fact);
    }
    if (!bucket.group_id && fact.group_id) {
      bucket.group_id = fact.group_id;
    }

    byClient.set(fact.client_id, bucket);
  }

  const rows: VrReportRow[] = [...byClient.entries()].map(([client_id, row]) => ({
    client_id,
    client_name: row.client_name,
    group_id: row.group_id,
    group_name: row.group_name,
    revenue: row.revenue,
    vr_rate_percent:
      row.revenue === 0
        ? 0
        : roundMoney((row.vr_amount_sum / row.revenue) * 100),
    monthly_vr: row.monthly_vr,
    total_vr: row.total_vr,
  }));

  return rows.sort((a, b) => {
    const groupCompare = a.group_name.localeCompare(b.group_name);
    if (groupCompare !== 0) return groupCompare;
    return a.client_name.localeCompare(b.client_name);
  });
}

function buildTotals(rows: VrReportRow[], scopeMonths: string[]): VrReportTotals {
  const monthly_vr = Object.fromEntries(scopeMonths.map((month) => [month, 0]));
  let revenue = 0;
  let total_vr = 0;

  for (const row of rows) {
    revenue = roundMoney(revenue + row.revenue);
    total_vr = roundMoney(total_vr + row.total_vr);
    for (const month of scopeMonths) {
      monthly_vr[month] = roundMoney(
        (monthly_vr[month] ?? 0) + (row.monthly_vr[month] ?? 0)
      );
    }
  }

  return { revenue, monthly_vr, total_vr };
}

export function buildVrReport(
  lineFacts: PnlLineFact[],
  year: number,
  periodScope: PnlPeriodScope,
  displayCurrency: string,
  availableCurrencies: string[]
): VrReportData {
  const scopeMonths = monthsForScope(year, periodScope);
  const yearFacts = lineFacts.filter((fact) =>
    fact.period_month?.startsWith(String(year))
  );
  const rows = aggregateClientRows(yearFacts, scopeMonths);
  const columns: VrReportColumn[] = scopeMonths.map((monthKey) => ({
    key: monthKey,
    label: formatPnLMonthLabel(monthKey),
    monthKey,
  }));

  return {
    year,
    period_scope: periodScope,
    period_label: periodScopeLabel(periodScope),
    display_currency: displayCurrency,
    available_currencies: availableCurrencies,
    client_type: "all",
    client_type_label: "All",
    columns,
    rows,
    totals: buildTotals(rows, scopeMonths),
    period_note: `All amounts shown in ${displayCurrency} using effective exchange rates. Revenue is billable (deliverable + UR + agency fees). VR amount is the vendor rebate refund per line.`,
    data_scope_note:
      "Includes active, paused, and completed campaigns only. Cancelled campaigns and lines are excluded. Client VR% is spending-weighted: sum(billable × effective brand VR%) ÷ total billable, where effective VR% is brand override or inherited client default. VR amount uses applyVrRefundToLineCommercial on ex-VAT cost. Months use campaign start date, or created date when start is unset.",
  };
}
