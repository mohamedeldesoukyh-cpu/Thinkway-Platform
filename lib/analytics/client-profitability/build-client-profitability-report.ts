import { roundMoney } from "@/lib/analytics/aggregations/round";
import type {
  ClientProfitabilityReportData,
  ClientProfitabilityRow,
} from "@/lib/analytics/client-profitability/client-profitability-types";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import {
  monthsForScope,
  periodScopeLabel,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import type { PnlLineFact } from "@/lib/analytics/pnl/pnl-report-types";
import { computeGpAfterVr } from "@/lib/analytics/pnl/vr-refund";

export type ClientProfitabilityMeta = {
  client_id: string;
  client_name: string;
  client_code: string | null;
  group_name: string | null;
};

function aggregateFactsByClient(
  facts: PnlLineFact[],
  scopeMonths: string[]
): Map<
  string,
  {
    client_name: string;
    revenue: number;
    ur_rev: number;
    agency_fees: number;
    gp: number;
    vr_refund: number;
  }
> {
  const byClient = new Map<
    string,
    {
      client_name: string;
      revenue: number;
      ur_rev: number;
      agency_fees: number;
      gp: number;
      vr_refund: number;
    }
  >();

  const filtered = facts.filter(
    (fact) => fact.period_month && scopeMonths.includes(fact.period_month)
  );

  for (const fact of filtered) {
    const bucket =
      byClient.get(fact.client_id) ??
      {
        client_name: fact.client_name,
        revenue: 0,
        ur_rev: 0,
        agency_fees: 0,
        gp: 0,
        vr_refund: 0,
      };
    bucket.revenue = roundMoney(bucket.revenue + fact.revenue);
    bucket.ur_rev = roundMoney(bucket.ur_rev + fact.ur_rev);
    bucket.agency_fees = roundMoney(bucket.agency_fees + fact.agency_fees);
    bucket.gp = roundMoney(bucket.gp + fact.gp);
    bucket.vr_refund = roundMoney(bucket.vr_refund + fact.vr_refund);
    byClient.set(fact.client_id, bucket);
  }

  return byClient;
}

function buildRow(
  meta: ClientProfitabilityMeta,
  totals?: {
    client_name: string;
    revenue: number;
    ur_rev: number;
    agency_fees: number;
    gp: number;
    vr_refund: number;
  }
): ClientProfitabilityRow {
  const revenue = totals?.revenue ?? 0;
  const urRev = totals?.ur_rev ?? 0;
  const agencyFees = totals?.agency_fees ?? 0;
  const gp = totals?.gp ?? 0;
  const vrRefund = totals?.vr_refund ?? 0;
  const billableRevenue = roundMoney(revenue + urRev + agencyFees);
  const gpAfterVr = computeGpAfterVr(gp, vrRefund);

  return {
    client_id: meta.client_id,
    client_name: meta.client_name,
    client_code: meta.client_code,
    group_name: meta.group_name,
    revenue: billableRevenue,
    gp,
    gp_after_vr: gpAfterVr,
    margin_percent: computeMarginPercent(billableRevenue, gpAfterVr),
  };
}

export function buildClientProfitabilityReport(
  lineFacts: PnlLineFact[],
  clients: ClientProfitabilityMeta[],
  year: number,
  periodScope: PnlPeriodScope,
  displayCurrency: string,
  availableCurrencies: string[],
  selectedClientIds: string[]
): ClientProfitabilityReportData {
  const scopeMonths = monthsForScope(year, periodScope);
  const yearFacts = lineFacts.filter((fact) =>
    fact.period_month?.startsWith(String(year))
  );
  const aggregated = aggregateFactsByClient(yearFacts, scopeMonths);

  const metaById = new Map(clients.map((client) => [client.client_id, client]));

  const rows: ClientProfitabilityRow[] = clients.map((meta) =>
    buildRow(meta, aggregated.get(meta.client_id))
  );

  rows.sort((a, b) => {
    if (b.gp_after_vr !== a.gp_after_vr) return b.gp_after_vr - a.gp_after_vr;
    return a.client_name.localeCompare(b.client_name);
  });

  const validSelectedIds = selectedClientIds.filter((id) => metaById.has(id));

  return {
    year,
    period_scope: periodScope,
    period_label: periodScopeLabel(periodScope),
    display_currency: displayCurrency,
    available_currencies: availableCurrencies,
    client_type: "all",
    client_type_label: "All",
    rows,
    selected_client_ids: validSelectedIds,
    period_note: `All amounts shown in ${displayCurrency} using effective exchange rates. GP is after VR refund; margin % is GP after VR divided by billable revenue.`,
    data_scope_note:
      "Includes active, paused, and completed campaigns only. Cancelled campaigns and lines are excluded. Billable revenue includes deliverable revenue, UR, and agency fees. Months use campaign start date, or created date when start is unset.",
  };
}

export function filterClientProfitabilityRows(
  report: ClientProfitabilityReportData
): ClientProfitabilityRow[] {
  if (report.selected_client_ids.length === 0) return report.rows;
  const selected = new Set(report.selected_client_ids);
  return report.rows.filter((row) => selected.has(row.client_id));
}
