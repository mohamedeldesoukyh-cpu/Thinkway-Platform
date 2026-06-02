import { mergeFinancialMetrics, emptyFinancialMetrics } from "@/lib/analytics/metrics/financial";
import { buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { devLog } from "@/lib/dev-log";
import type {
  AnalyticsQueryFilters,
  AnalyticsRollupLevel,
} from "@/lib/analytics/types/filters";
import type {
  AnalyticsRollupNode,
  CampaignAnalyticsFact,
} from "@/lib/analytics/types/metrics";

export type RollupGroupKey = {
  level: AnalyticsRollupLevel;
  key: string;
  label: string;
};

function groupKeyForFact(
  fact: CampaignAnalyticsFact,
  level: AnalyticsRollupLevel
): RollupGroupKey {
  switch (level) {
    case "campaign":
      return {
        level,
        key: fact.campaign_header_id,
        label: `${fact.campaign_document_number} · ${fact.campaign_name}`,
      };
    case "client":
      return {
        level,
        key: fact.client_id,
        label: fact.client_name || "Unknown client",
      };
    case "brand":
      return {
        level,
        key: fact.brand_id ?? "unassigned",
        label: fact.brand_name ?? "Unassigned brand",
      };
    case "country":
      return {
        level,
        key: (fact.country_code ?? "unknown").toUpperCase(),
        label: fact.country_code ?? "Unknown",
      };
    case "team":
      return {
        level,
        key: fact.team_id ?? "unassigned",
        label: fact.team_name ?? "Unassigned team",
      };
    case "global":
      return { level, key: "global", label: "Global" };
    default:
      return { level: "global", key: "global", label: "Global" };
  }
}

export function rollupFacts(
  facts: CampaignAnalyticsFact[],
  level: AnalyticsRollupLevel,
  filters?: AnalyticsQueryFilters
): AnalyticsRollupNode[] {
  const filtered = applyFactFilters(facts, filters);
  const groups = new Map<
    string,
    {
      meta: RollupGroupKey;
      metrics: ReturnType<typeof emptyFinancialMetrics>;
      currencies: string[];
      campaignIds: Set<string>;
    }
  >();

  for (const fact of filtered) {
    const meta = groupKeyForFact(fact, level);
    const bucket =
      groups.get(meta.key) ??
      {
        meta,
        metrics: emptyFinancialMetrics(),
        currencies: [],
        campaignIds: new Set<string>(),
      };

    bucket.metrics = mergeFinancialMetrics(bucket.metrics, fact.metrics);
    bucket.currencies.push(fact.currency_code);
    bucket.campaignIds.add(fact.campaign_header_id);
    groups.set(meta.key, bucket);
  }

  const nodes: AnalyticsRollupNode[] = [...groups.values()]
    .map((group) => ({
      level: group.meta.level,
      key: group.meta.key,
      label: group.meta.label,
      currency: buildCurrencyContext(group.currencies),
      metrics: group.metrics,
      campaign_count: group.campaignIds.size,
    }))
    .sort((a, b) => b.metrics.revenue - a.metrics.revenue);

  if (process.env.NODE_ENV === "development") {
    devLog("[analytics-rollup] computed hierarchy rollup", {
      level,
      factCount: filtered.length,
      nodeCount: nodes.length,
    });
  }

  return nodes;
}

export function rollupGlobal(facts: CampaignAnalyticsFact[]): AnalyticsRollupNode {
  const nodes = rollupFacts(facts, "global");
  return (
    nodes[0] ?? {
      level: "global",
      key: "global",
      label: "Global",
      currency: buildCurrencyContext([]),
      metrics: emptyFinancialMetrics(),
      campaign_count: 0,
    }
  );
}

function applyFactFilters(
  facts: CampaignAnalyticsFact[],
  filters?: AnalyticsQueryFilters
): CampaignAnalyticsFact[] {
  if (!filters) return facts;

  return facts.filter((fact) => {
    if (filters.clientIds?.length && !filters.clientIds.includes(fact.client_id)) {
      return false;
    }
    if (filters.brandIds?.length && fact.brand_id && !filters.brandIds.includes(fact.brand_id)) {
      return false;
    }
    if (
      filters.countryCodes?.length &&
      fact.country_code &&
      !filters.countryCodes.includes(fact.country_code)
    ) {
      return false;
    }
    if (filters.teamIds?.length && fact.team_id && !filters.teamIds.includes(fact.team_id)) {
      return false;
    }
    if (
      filters.campaignHeaderIds?.length &&
      !filters.campaignHeaderIds.includes(fact.campaign_header_id)
    ) {
      return false;
    }
    if (filters.currencyCode && fact.currency_code !== filters.currencyCode) {
      return false;
    }

    const m = fact.metrics;

    switch (filters.billingFilter) {
      case "not_invoiced":
        if (m.invoiced_revenue > 0) return false;
        break;
      case "partially_invoiced":
        if (!(m.invoiced_revenue > 0 && m.remaining_to_invoice > 0)) return false;
        break;
      case "invoiced":
        if (m.invoiced_revenue <= 0) return false;
        break;
      case "in_collections":
        if (m.outstanding_revenue <= 0) return false;
        break;
      case "collected":
        if (m.collected_revenue <= 0) return false;
        break;
      default:
        break;
    }

    switch (filters.operationalFilter) {
      case "achieved":
        if (m.achieved_revenue <= 0) return false;
        break;
      case "unachieved":
        if (m.unachieved_revenue <= 0) return false;
        break;
      case "approved":
      case "moved_to_billing":
      case "draft":
        break;
      default:
        break;
    }

    return true;
  });
}
