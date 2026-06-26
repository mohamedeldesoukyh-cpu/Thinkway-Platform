import { roundMoney } from "@/lib/analytics/aggregations/round";
import {
  clientTypeFilterLabel,
  matchesClientType,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import {
  monthsForScope,
  periodScopeLabel,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import type { InfluencerSpendFact } from "@/lib/analytics/top-influencers/influencer-spend-fact";
import type {
  TopInfluencersMetric,
  TopInfluencersReportData,
  TopInfluencersRow,
} from "@/lib/analytics/top-influencers/top-influencers-types";
import {
  TOP_INFLUENCERS_DEFAULT_LIMIT,
  TOP_INFLUENCERS_MAX_LIMIT,
  TOP_INFLUENCERS_MIN_LIMIT,
} from "@/lib/analytics/top-influencers/top-influencers-types";
import type { AgencyOrDirect } from "@/types/database";

export type TopInfluencersClientMeta = {
  client_id: string;
  agency_or_direct: AgencyOrDirect | null;
};

function aggregateFactsByInfluencer(
  facts: InfluencerSpendFact[],
  scopeMonths: string[]
): Map<
  string,
  {
    influencer_name: string;
    document_number: string;
    platform: string | null;
    handle: string | null;
    profile_url: string | null;
    spending: number;
    revenue: number;
    gp: number;
  }
> {
  const byInfluencer = new Map<
    string,
    {
      influencer_name: string;
      document_number: string;
      platform: string | null;
      handle: string | null;
      profile_url: string | null;
      spending: number;
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
      byInfluencer.get(fact.influencer_id) ??
      {
        influencer_name: fact.influencer_name,
        document_number: fact.document_number,
        platform: fact.platform,
        handle: fact.handle,
        profile_url: fact.profile_url,
        spending: 0,
        revenue: 0,
        gp: 0,
      };
    bucket.spending = roundMoney(bucket.spending + fact.spending);
    bucket.revenue = roundMoney(bucket.revenue + billableRevenue);
    bucket.gp = roundMoney(bucket.gp + gpAfterVr);
    byInfluencer.set(fact.influencer_id, bucket);
  }

  return byInfluencer;
}

function metricLabel(metric: TopInfluencersMetric): string {
  switch (metric) {
    case "spending":
      return "Spending";
    case "gp":
      return "GP";
    case "revenue":
    default:
      return "Revenue";
  }
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return TOP_INFLUENCERS_DEFAULT_LIMIT;
  return Math.min(
    TOP_INFLUENCERS_MAX_LIMIT,
    Math.max(TOP_INFLUENCERS_MIN_LIMIT, Math.round(limit))
  );
}

function metricValue(row: Omit<TopInfluencersRow, "rank">, metric: TopInfluencersMetric): number {
  switch (metric) {
    case "spending":
      return row.spending;
    case "gp":
      return row.gp;
    case "revenue":
    default:
      return row.revenue;
  }
}

export function buildTopInfluencersReport(
  facts: InfluencerSpendFact[],
  clients: TopInfluencersClientMeta[],
  year: number,
  periodScope: PnlPeriodScope,
  displayCurrency: string,
  availableCurrencies: string[],
  metric: TopInfluencersMetric,
  limit: number,
  clientType: ClientTypeFilter
): TopInfluencersReportData {
  const scopeMonths = monthsForScope(year, periodScope);
  const agencyByClient = new Map(
    clients.map((client) => [client.client_id, client.agency_or_direct])
  );

  const yearFacts = facts.filter((fact) => {
    if (!fact.period_month?.startsWith(String(year))) return false;
    const agencyOrDirect = agencyByClient.get(fact.client_id) ?? null;
    return matchesClientType(agencyOrDirect, clientType);
  });

  const aggregated = aggregateFactsByInfluencer(yearFacts, scopeMonths);
  const candidates: Omit<TopInfluencersRow, "rank">[] = [];

  for (const [influencerId, totals] of aggregated) {
    if (totals.spending === 0 && totals.revenue === 0 && totals.gp === 0) continue;

    candidates.push({
      influencer_id: influencerId,
      influencer_name: totals.influencer_name,
      document_number: totals.document_number,
      platform: totals.platform,
      handle: totals.handle,
      profile_url: totals.profile_url,
      spending: totals.spending,
      revenue: totals.revenue,
      gp: totals.gp,
      gp_percent: computeMarginPercent(totals.revenue, totals.gp),
    });
  }

  candidates.sort((a, b) => {
    const primary = metricValue(b, metric) - metricValue(a, metric);
    if (primary !== 0) return primary;
    return a.influencer_name.localeCompare(b.influencer_name);
  });

  const effectiveLimit = clampLimit(limit);
  const rows: TopInfluencersRow[] = candidates.slice(0, effectiveLimit).map((row, index) => ({
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
    period_note: `All amounts shown in ${displayCurrency} using effective exchange rates. Spending is vendor cost (COGS) after VR refund; GP is after VR refund; GP % is GP divided by billable revenue.`,
    data_scope_note:
      "Includes active, paused, and completed campaigns only. Cancelled campaigns and lines are excluded. Spending sums assignment line cost (cost before VAT plus usage-rights cost) per assigned vendor. Billable revenue includes deliverable revenue, UR, and agency fees. Client type filters by the campaign legal entity agency/direct classification. Months use campaign start date, or created date when start is unset.",
  };
}
