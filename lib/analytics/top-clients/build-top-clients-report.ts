import { roundMoney } from "@/lib/analytics/aggregations/round";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import {
  monthsForScope,
  periodScopeLabel,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import type { PnlLineFact } from "@/lib/analytics/pnl/pnl-report-types";
import {
  clientTypeFilterLabel,
  matchesClientType,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
import type {
  TopClientsMetric,
  TopClientsReportData,
  TopClientsRow,
} from "@/lib/analytics/top-clients/top-clients-types";
import {
  TOP_CLIENTS_DEFAULT_LIMIT,
  TOP_CLIENTS_MAX_LIMIT,
  TOP_CLIENTS_MIN_LIMIT,
} from "@/lib/analytics/top-clients/top-clients-types";
import type { AgencyOrDirect } from "@/types/database";

export type TopClientsClientMeta = {
  client_id: string;
  client_name: string;
  agency_or_direct: AgencyOrDirect | null;
};

function aggregateFactsByClient(
  facts: PnlLineFact[],
  scopeMonths: string[]
): Map<
  string,
  {
    client_name: string;
    revenue: number;
    gp: number;
  }
> {
  const byClient = new Map<
    string,
    {
      client_name: string;
      revenue: number;
      gp: number;
    }
  >();

  const filtered = facts.filter(
    (fact) => fact.period_month && scopeMonths.includes(fact.period_month)
  );

  for (const fact of filtered) {
    const billableRevenue = roundMoney(
      fact.revenue + fact.ur_rev + fact.agency_fees
    );
    const gpAfterVr = roundMoney(fact.gp_after_vr);

    const bucket =
      byClient.get(fact.client_id) ??
      {
        client_name: fact.client_name,
        revenue: 0,
        gp: 0,
      };
    bucket.revenue = roundMoney(bucket.revenue + billableRevenue);
    bucket.gp = roundMoney(bucket.gp + gpAfterVr);
    byClient.set(fact.client_id, bucket);
  }

  return byClient;
}

function metricLabel(metric: TopClientsMetric): string {
  return metric === "gp" ? "GP" : "Revenue";
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return TOP_CLIENTS_DEFAULT_LIMIT;
  return Math.min(
    TOP_CLIENTS_MAX_LIMIT,
    Math.max(TOP_CLIENTS_MIN_LIMIT, Math.round(limit))
  );
}

export function buildTopClientsReport(
  lineFacts: PnlLineFact[],
  clients: TopClientsClientMeta[],
  year: number,
  periodScope: PnlPeriodScope,
  displayCurrency: string,
  availableCurrencies: string[],
  metric: TopClientsMetric,
  limit: number,
  clientType: ClientTypeFilter
): TopClientsReportData {
  const scopeMonths = monthsForScope(year, periodScope);
  const yearFacts = lineFacts.filter((fact) =>
    fact.period_month?.startsWith(String(year))
  );
  const aggregated = aggregateFactsByClient(yearFacts, scopeMonths);
  const agencyByClient = new Map(
    clients.map((client) => [client.client_id, client.agency_or_direct])
  );
  const nameByClient = new Map(
    clients.map((client) => [client.client_id, client.client_name])
  );

  const candidates: Omit<TopClientsRow, "rank">[] = [];

  for (const [clientId, totals] of aggregated) {
    const agencyOrDirect = agencyByClient.get(clientId) ?? null;
    if (!matchesClientType(agencyOrDirect, clientType)) continue;
    if (totals.revenue === 0 && totals.gp === 0) continue;

    candidates.push({
      client_id: clientId,
      client_name: nameByClient.get(clientId) ?? totals.client_name,
      agency_or_direct: agencyOrDirect,
      revenue: totals.revenue,
      gp: totals.gp,
      gp_percent: computeMarginPercent(totals.revenue, totals.gp),
    });
  }

  candidates.sort((a, b) => {
    const primary = metric === "gp" ? b.gp - a.gp : b.revenue - a.revenue;
    if (primary !== 0) return primary;
    return a.client_name.localeCompare(b.client_name);
  });

  const effectiveLimit = clampLimit(limit);
  const rows: TopClientsRow[] = candidates.slice(0, effectiveLimit).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

  return {
    year,
    period_scope: periodScope,
    period_label: periodScopeLabel(periodScope),
    display_currency: displayCurrency,
    available_currencies: availableCurrencies,
    metric,
    metric_label: metricLabel(metric),
    limit: effectiveLimit,
    client_type: clientType,
    client_type_label: clientTypeFilterLabel(clientType),
    rows,
    period_note: `All amounts shown in ${displayCurrency} using effective exchange rates. GP is after VR refund; GP % is GP divided by billable revenue.`,
    data_scope_note:
      "Includes active, paused, and completed campaigns only. Cancelled campaigns and lines are excluded. Billable revenue includes deliverable revenue, UR, and agency fees. Client type uses the legal entity agency/direct classification. Months use campaign start date, or created date when start is unset.",
  };
}
