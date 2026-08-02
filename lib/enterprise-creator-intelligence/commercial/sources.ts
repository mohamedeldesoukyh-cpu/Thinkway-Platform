import type {
  CommercialMetricKey,
  CommercialMetricSource,
} from "@/lib/enterprise-creator-intelligence/commercial/types";

type SourceTemplate = Omit<
  CommercialMetricSource,
  "lastRefresh" | "confidence"
>;

/** Canonical metric source attribution for debugging, AI, clients, reporting. */
export const COMMERCIAL_METRIC_SOURCE_TEMPLATES: Record<
  CommercialMetricKey,
  SourceTemplate
> = {
  cpm: {
    id: "thinkway_commercial_data",
    label: "Thinkway Commercial Data",
    system: "Thinkway Platform",
    collectionMethod:
      "Aggregated from campaign_influencers cost + campaign_publications impressions",
  },
  cpe: {
    id: "thinkway_campaign_performance",
    label: "Thinkway Campaign Performance",
    system: "Thinkway Platform",
    collectionMethod:
      "Aggregated from Thinkway campaign publication engagements and commercial cost",
  },
  emv: {
    id: "thinkway_commercial_formula",
    label: "Thinkway Commercial Formula",
    system: "Thinkway Platform",
    collectionMethod:
      "Computed via Thinkway EMV formula using impressions and quote-implied benchmark CPM",
  },
  roi: {
    id: "thinkway_campaign_results",
    label: "Thinkway Campaign Results",
    system: "Thinkway Platform",
    collectionMethod:
      "Attributed deliverable revenue vs campaign influencer / publication cost",
  },
  average_views: {
    id: "platform_historical_metrics",
    label: "Platform Historical Metrics",
    system: "Thinkway Platform",
    collectionMethod:
      "Sprint 1 monthly historical series with publication view fallback",
  },
  median_views: {
    id: "platform_historical_metrics",
    label: "Platform Historical Metrics",
    system: "Thinkway Platform",
    collectionMethod:
      "Sprint 1 monthly historical series with publication view fallback",
  },
  average_reach: {
    id: "thinkway_campaign_performance",
    label: "Thinkway Campaign Performance",
    system: "Thinkway Platform",
    collectionMethod: "Mean actual reach from campaign_publications",
  },
  estimated_reach: {
    id: "thinkway_campaign_performance",
    label: "Thinkway Campaign Performance",
    system: "Thinkway Platform",
    collectionMethod: "Mean forecast_reach from campaign_publications",
  },
  cost_per_deliverable: {
    id: "thinkway_commercial_data",
    label: "Thinkway Commercial Data",
    system: "Thinkway Platform",
    collectionMethod:
      "Total assignment cost divided by deliverable_count on campaign_influencers",
  },
  historical_pricing: {
    id: "commercial_negotiation_history",
    label: "Commercial Negotiation History",
    system: "Thinkway Platform",
    collectionMethod: "Mean quoted cost from quotation_items history",
  },
  negotiation_trend: {
    id: "commercial_negotiation_history",
    label: "Commercial Negotiation History",
    system: "Thinkway Platform",
    collectionMethod: "Directional index across chronological quotation costs",
  },
  price_movement: {
    id: "commercial_negotiation_history",
    label: "Commercial Negotiation History",
    system: "Thinkway Platform",
    collectionMethod: "Latest quote versus prior quote ratio",
  },
};

/** @deprecated Prefer resolveCommercialMetricSource — label map for tests/docs. */
export const COMMERCIAL_METRIC_SOURCES: Record<
  CommercialMetricKey,
  { id: string; label: string }
> = Object.fromEntries(
  Object.entries(COMMERCIAL_METRIC_SOURCE_TEMPLATES).map(([key, value]) => [
    key,
    { id: value.id, label: value.label },
  ])
) as Record<CommercialMetricKey, { id: string; label: string }>;

export function platformHistoricalSourceLabel(platform: string | null): string {
  if (!platform) return "Platform Historical Metrics";
  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
  return `${label} Historical Metrics`;
}

export function resolveCommercialMetricSource(input: {
  key: CommercialMetricKey;
  labelOverride?: string;
  lastRefresh: string | null;
  confidence: number | null;
}): CommercialMetricSource {
  const template = COMMERCIAL_METRIC_SOURCE_TEMPLATES[input.key];
  return {
    ...template,
    label: input.labelOverride ?? template.label,
    lastRefresh: input.lastRefresh,
    confidence: input.confidence,
  };
}
