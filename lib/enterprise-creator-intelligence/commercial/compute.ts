import type { PerformanceMetricInput } from "@/lib/campaigns/performance-calculations";
import { computeCommercialConfidence } from "@/lib/enterprise-creator-intelligence/commercial/confidence";
import {
  clampConfidenceToEvidence,
  commercialEvidenceCoverage,
} from "@/lib/enterprise-creator-intelligence/shared/evidence-coverage";
import { buildCommercialMetric } from "@/lib/enterprise-creator-intelligence/commercial/build-metric";
import {
  FORMULA_IDS,
  FORMULA_TEXT,
  averageOf,
  computeCommercialCpe,
  computeCommercialCpm,
  computeCommercialEmv,
  computeCommercialRoi,
  computeCostPerDeliverable,
  computeImpliedBenchmarkCpm,
  computePriceMovementRatio,
  medianOf,
  negotiationTrendFromSeries,
} from "@/lib/enterprise-creator-intelligence/commercial/formulas";
import { computeCommercialHealth } from "@/lib/enterprise-creator-intelligence/commercial/health";
import { computeInvestmentReadiness } from "@/lib/enterprise-creator-intelligence/commercial/readiness";
import { platformHistoricalSourceLabel } from "@/lib/enterprise-creator-intelligence/commercial/sources";
import type {
  CommercialMetric,
  CommercialMetricKey,
  CommercialMetricPoint,
  CreatorCommercialAiHints,
  CreatorCommercialIntelligence,
} from "@/lib/enterprise-creator-intelligence/commercial/types";
import { COMMERCIAL_INTELLIGENCE_CONSUMERS } from "@/lib/enterprise-creator-intelligence/commercial/types";

export type CommercialPublicationFact = {
  cost: number | null;
  currency: string | null;
  impressions: number | null;
  views: number | null;
  reach: number | null;
  forecastReach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagements: number | null;
  publishedAt: string | null;
  campaignHeaderId: string | null;
};

export type CommercialAssignmentFact = {
  costBeforeVat: number | null;
  currency: string | null;
  deliverableCount: number | null;
  campaignHeaderId: string | null;
  campaignLineId: string | null;
};

export type CommercialQuoteFact = {
  cost: number;
  currency: string;
  quotedAt: string;
};

export type CommercialHistoricalViewsFact = {
  avgViews: number | null;
  medianViews: number | null;
  periodMonth: string;
  platform: string;
};

export type CreatorCommercialFacts = {
  influencerId: string;
  platform: string | null;
  computedAt?: string;
  publications: CommercialPublicationFact[];
  assignments: CommercialAssignmentFact[];
  /** Revenue attributed via assignment deliverables on the creator's campaign lines. */
  attributedRevenue: number | null;
  revenueCurrency: string | null;
  quotes: CommercialQuoteFact[];
  historicalMonths: CommercialHistoricalViewsFact[];
  /** Prior capture metric values for previous/trend (append-only history). */
  priorMetrics?: Partial<Record<CommercialMetricKey, number | null>>;
  priorTrend?: Partial<Record<CommercialMetricKey, CommercialMetricPoint[]>>;
};

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((s, v) => s + (v == null || !Number.isFinite(v) ? 0 : Number(v)), 0);
}

function uniqueCampaignCount(facts: CreatorCommercialFacts): number {
  const ids = new Set<string>();
  for (const p of facts.publications) {
    if (p.campaignHeaderId) ids.add(p.campaignHeaderId);
  }
  for (const a of facts.assignments) {
    if (a.campaignHeaderId) ids.add(a.campaignHeaderId);
  }
  return ids.size;
}

function monthSpan(facts: CreatorCommercialFacts): number {
  const stamps: number[] = [];
  for (const p of facts.publications) {
    if (p.publishedAt) stamps.push(new Date(p.publishedAt).getTime());
  }
  for (const q of facts.quotes) {
    stamps.push(new Date(q.quotedAt).getTime());
  }
  for (const m of facts.historicalMonths) {
    stamps.push(new Date(`${m.periodMonth}T00:00:00.000Z`).getTime());
  }
  if (stamps.length < 2) return stamps.length > 0 ? 1 : 0;
  const min = Math.min(...stamps);
  const max = Math.max(...stamps);
  return Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24 * 30.44)));
}

function dominantCurrency(facts: CreatorCommercialFacts): string | null {
  const counts = new Map<string, number>();
  const bump = (c: string | null | undefined) => {
    if (!c) return;
    const key = c.toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const p of facts.publications) bump(p.currency);
  for (const a of facts.assignments) bump(a.currency);
  for (const q of facts.quotes) bump(q.currency);
  bump(facts.revenueCurrency);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function buildAiHints(
  metrics: CommercialMetric[],
  healthLevel: CreatorCommercialAiHints["commercialHealth"],
  readiness: CreatorCommercialAiHints["investmentReadiness"]
): CreatorCommercialAiHints {
  const lowConfidenceKeys = metrics
    .filter((m) => m.confidence.percent != null && m.confidence.percent < 50)
    .map((m) => m.key);
  const moneyReady = metrics.some(
    (m) => m.unit === "money" && m.currentValue != null && m.currencyCode
  );
  return {
    metricsAvailable: metrics.some((m) => m.currentValue != null),
    metricCount: metrics.filter((m) => m.currentValue != null).length,
    moneyMetricsReady: moneyReady,
    lowConfidenceKeys,
    recommendCommercialRefresh: metrics.every((m) => m.currentValue == null),
    commercialHealth: healthLevel,
    investmentReadiness: readiness,
  };
}

/** Pure commercial intelligence computation from Thinkway + historical facts. */
export function computeCreatorCommercialIntelligence(
  facts: CreatorCommercialFacts
): CreatorCommercialIntelligence {
  const computedAt = facts.computedAt ?? new Date().toISOString();
  const currencyCode = dominantCurrency(facts);
  const campaignCount = uniqueCampaignCount(facts);
  const months = monthSpan(facts);

  const totalCostPubs = sum(facts.publications.map((p) => p.cost));
  const totalImpressions = sum(facts.publications.map((p) => p.impressions));
  const totalViews = sum(facts.publications.map((p) => p.views));
  const totalEngagements = sum(
    facts.publications.map((p) => {
      if (p.engagements != null) return p.engagements;
      return (
        (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)
      );
    })
  );

  const assignmentCost = sum(facts.assignments.map((a) => a.costBeforeVat));
  const deliverableCount = sum(facts.assignments.map((a) => a.deliverableCount));
  const commercialCost = assignmentCost > 0 ? assignmentCost : totalCostPubs;

  const aggMetrics: PerformanceMetricInput = {
    impressions: totalImpressions || null,
    reach: sum(facts.publications.map((p) => p.reach)) || null,
    views: totalViews || null,
    likes: sum(facts.publications.map((p) => p.likes)) || null,
    comments: sum(facts.publications.map((p) => p.comments)) || null,
    shares: sum(facts.publications.map((p) => p.shares)) || null,
    saves: sum(facts.publications.map((p) => p.saves)) || null,
    clicks: null,
    cost: commercialCost > 0 ? commercialCost : null,
  };

  const latestMonth = facts.historicalMonths[facts.historicalMonths.length - 1];
  const priorMonth =
    facts.historicalMonths.length > 1
      ? facts.historicalMonths[facts.historicalMonths.length - 2]
      : null;

  const avgViewsHistorical = latestMonth?.avgViews ?? null;
  const medianViewsHistorical = latestMonth?.medianViews ?? null;
  const avgViewsPubs = averageOf(facts.publications.map((p) => p.views));
  const medianViewsPubs = medianOf(facts.publications.map((p) => p.views));
  const averageViews = avgViewsHistorical ?? avgViewsPubs;
  const medianViews = medianViewsHistorical ?? medianViewsPubs;

  const averageReach = averageOf(
    facts.publications.map((p) => p.reach).filter((v) => v != null && v > 0)
  );
  const estimatedReach = averageOf(
    facts.publications
      .map((p) => p.forecastReach)
      .filter((v) => v != null && v > 0)
  );

  const quoteCostsChrono = [...facts.quotes]
    .sort((a, b) => a.quotedAt.localeCompare(b.quotedAt))
    .map((q) => q.cost);
  const historicalPricing = averageOf(quoteCostsChrono);
  const latestQuote = quoteCostsChrono[quoteCostsChrono.length - 1] ?? null;
  const priorQuote =
    quoteCostsChrono.length > 1
      ? quoteCostsChrono[quoteCostsChrono.length - 2]!
      : null;
  const negotiationTrend = negotiationTrendFromSeries(quoteCostsChrono);
  const priceMovement = computePriceMovementRatio(latestQuote, priorQuote);

  const quoteCurrency =
    facts.quotes[0]?.currency?.toUpperCase() ?? currencyCode;

  const benchmarkCpm = computeImpliedBenchmarkCpm(
    historicalPricing,
    averageViews
  );

  const cpm = computeCommercialCpm(
    commercialCost > 0 ? commercialCost : null,
    totalImpressions > 0 ? totalImpressions : null
  );
  const cpe = computeCommercialCpe(
    commercialCost > 0 ? commercialCost : null,
    aggMetrics
  );
  const emv = computeCommercialEmv(
    totalImpressions > 0 ? totalImpressions : null,
    benchmarkCpm
  );
  const roi = computeCommercialRoi(
    facts.attributedRevenue,
    commercialCost > 0 ? commercialCost : null
  );
  const costPerDeliverable = computeCostPerDeliverable(
    commercialCost > 0 ? commercialCost : null,
    deliverableCount > 0 ? deliverableCount : null
  );

  const efficiencyConfidence = computeCommercialConfidence(
    {
      campaignCount,
      monthCount: months,
      engagementTotal: totalEngagements,
      impressionTotal: totalImpressions,
      publicationCount: facts.publications.length,
    },
    "efficiency"
  );
  const roiConfidence = computeCommercialConfidence(
    {
      campaignCount,
      monthCount: months,
      engagementTotal: totalEngagements,
      publicationCount: facts.publications.length,
    },
    "roi"
  );
  const viewsConfidence = computeCommercialConfidence(
    {
      viewSampleCount:
        facts.historicalMonths.filter((m) => m.avgViews != null).length ||
        facts.publications.filter((p) => p.views != null).length,
      monthCount: facts.historicalMonths.length || months,
      publicationCount: facts.publications.length,
    },
    "views"
  );
  const reachConfidence = computeCommercialConfidence(
    {
      reachSampleCount: facts.publications.filter((p) => p.reach != null).length,
      campaignCount,
    },
    "reach"
  );
  const pricingConfidence = computeCommercialConfidence(
    {
      quoteCount: facts.quotes.length,
      monthCount: months,
    },
    "pricing"
  );
  const deliverableConfidence = computeCommercialConfidence(
    {
      deliverableCount,
      campaignCount,
    },
    "deliverable"
  );

  const histSourceLabel = platformHistoricalSourceLabel(
    latestMonth?.platform ?? facts.platform
  );

  const prior = facts.priorMetrics ?? {};
  const priorTrend = facts.priorTrend ?? {};

  const missing = (...keys: string[]) => keys;

  const metrics: CommercialMetric[] = [
    buildCommercialMetric({
      key: "cpm",
      label: "CPM",
      currentValue: cpm,
      previousValue: prior.cpm ?? null,
      historicalTrend: priorTrend.cpm ?? [],
      lastUpdated: computedAt,
      currencyCode,
      unit: "money",
      confidence: efficiencyConfidence,
      formulaUsed: FORMULA_TEXT.cpm,
      formulaId: FORMULA_IDS.cpm,
      inputData: {
        cost: commercialCost > 0 ? commercialCost : null,
        impressions: totalImpressions > 0 ? totalImpressions : null,
      },
      missingInputs: [
        ...(commercialCost <= 0 ? missing("cost") : []),
        ...(totalImpressions <= 0 ? missing("impressions") : []),
      ],
    }),
    buildCommercialMetric({
      key: "cpe",
      label: "CPE",
      currentValue: cpe,
      previousValue: prior.cpe ?? null,
      historicalTrend: priorTrend.cpe ?? [],
      lastUpdated: computedAt,
      currencyCode,
      unit: "money",
      confidence: efficiencyConfidence,
      formulaUsed: FORMULA_TEXT.cpe,
      formulaId: FORMULA_IDS.cpe,
      inputData: {
        cost: commercialCost > 0 ? commercialCost : null,
        engagements: totalEngagements > 0 ? totalEngagements : null,
      },
      missingInputs: [
        ...(commercialCost <= 0 ? missing("cost") : []),
        ...(totalEngagements <= 0 ? missing("engagements") : []),
      ],
    }),
    buildCommercialMetric({
      key: "emv",
      label: "EMV",
      currentValue: emv,
      previousValue: prior.emv ?? null,
      historicalTrend: priorTrend.emv ?? [],
      lastUpdated: computedAt,
      currencyCode,
      unit: "money",
      confidence: efficiencyConfidence,
      formulaUsed: FORMULA_TEXT.emv,
      formulaId: FORMULA_IDS.emv,
      inputData: {
        impressions: totalImpressions > 0 ? totalImpressions : null,
        benchmark_cpm: benchmarkCpm,
        avg_quoted_cost: historicalPricing,
        avg_views: averageViews,
      },
      missingInputs: [
        ...(totalImpressions <= 0 ? missing("impressions") : []),
        ...(benchmarkCpm == null ? missing("benchmark_cpm") : []),
      ],
    }),
    buildCommercialMetric({
      key: "roi",
      label: "ROI",
      currentValue: roi,
      previousValue: prior.roi ?? null,
      historicalTrend: priorTrend.roi ?? [],
      lastUpdated: computedAt,
      currencyCode: null,
      unit: "ratio",
      confidence: roiConfidence,
      formulaUsed: FORMULA_TEXT.roi,
      formulaId: FORMULA_IDS.roi,
      inputData: {
        revenue: facts.attributedRevenue,
        cost: commercialCost > 0 ? commercialCost : null,
      },
      missingInputs: [
        ...(facts.attributedRevenue == null ? missing("revenue") : []),
        ...(commercialCost <= 0 ? missing("cost") : []),
      ],
    }),
    buildCommercialMetric({
      key: "average_views",
      label: "Average Views",
      currentValue: averageViews,
      previousValue: prior.average_views ?? priorMonth?.avgViews ?? null,
      historicalTrend: priorTrend.average_views ?? [],
      lastUpdated: computedAt,
      unit: "count",
      confidence: viewsConfidence,
      sourceLabelOverride: histSourceLabel,
      formulaUsed: FORMULA_TEXT.average_views,
      formulaId: FORMULA_IDS.average_views,
      inputData: {
        historical_avg_views: avgViewsHistorical,
        publication_avg_views: avgViewsPubs,
      },
      missingInputs: averageViews == null ? missing("views_sample") : [],
    }),
    buildCommercialMetric({
      key: "median_views",
      label: "Median Views",
      currentValue: medianViews,
      previousValue: prior.median_views ?? priorMonth?.medianViews ?? null,
      historicalTrend: priorTrend.median_views ?? [],
      lastUpdated: computedAt,
      unit: "count",
      confidence: viewsConfidence,
      sourceLabelOverride: histSourceLabel,
      formulaUsed: FORMULA_TEXT.median_views,
      formulaId: FORMULA_IDS.median_views,
      inputData: {
        historical_median_views: medianViewsHistorical,
        publication_median_views: medianViewsPubs,
      },
      missingInputs: medianViews == null ? missing("views_sample") : [],
    }),
    buildCommercialMetric({
      key: "average_reach",
      label: "Average Reach",
      currentValue: averageReach,
      previousValue: prior.average_reach ?? null,
      historicalTrend: priorTrend.average_reach ?? [],
      lastUpdated: computedAt,
      unit: "count",
      confidence: reachConfidence,
      formulaUsed: FORMULA_TEXT.average_reach,
      formulaId: FORMULA_IDS.average_reach,
      inputData: {
        reach_sample_count: facts.publications.filter((p) => p.reach != null)
          .length,
      },
      missingInputs: averageReach == null ? missing("reach") : [],
    }),
    buildCommercialMetric({
      key: "estimated_reach",
      label: "Estimated Reach",
      currentValue: estimatedReach,
      previousValue: prior.estimated_reach ?? null,
      historicalTrend: priorTrend.estimated_reach ?? [],
      lastUpdated: computedAt,
      unit: "count",
      confidence: reachConfidence,
      formulaUsed: FORMULA_TEXT.estimated_reach,
      formulaId: FORMULA_IDS.estimated_reach,
      inputData: {
        forecast_reach_sample_count: facts.publications.filter(
          (p) => p.forecastReach != null
        ).length,
      },
      missingInputs: estimatedReach == null ? missing("forecast_reach") : [],
    }),
    buildCommercialMetric({
      key: "cost_per_deliverable",
      label: "Cost Per Deliverable",
      currentValue: costPerDeliverable,
      previousValue: prior.cost_per_deliverable ?? null,
      historicalTrend: priorTrend.cost_per_deliverable ?? [],
      lastUpdated: computedAt,
      currencyCode,
      unit: "money",
      confidence: deliverableConfidence,
      formulaUsed: FORMULA_TEXT.cost_per_deliverable,
      formulaId: FORMULA_IDS.cost_per_deliverable,
      inputData: {
        total_cost: commercialCost > 0 ? commercialCost : null,
        deliverable_count: deliverableCount > 0 ? deliverableCount : null,
      },
      missingInputs: [
        ...(commercialCost <= 0 ? missing("cost") : []),
        ...(deliverableCount <= 0 ? missing("deliverable_count") : []),
      ],
    }),
    buildCommercialMetric({
      key: "historical_pricing",
      label: "Historical Pricing",
      currentValue: historicalPricing,
      previousValue: prior.historical_pricing ?? null,
      historicalTrend: priorTrend.historical_pricing ?? [],
      lastUpdated: computedAt,
      currencyCode: quoteCurrency,
      unit: "money",
      confidence: pricingConfidence,
      formulaUsed: FORMULA_TEXT.historical_pricing,
      formulaId: FORMULA_IDS.historical_pricing,
      inputData: {
        quote_count: facts.quotes.length,
        avg_quoted_cost: historicalPricing,
      },
      missingInputs: historicalPricing == null ? missing("quotes") : [],
    }),
    buildCommercialMetric({
      key: "negotiation_trend",
      label: "Negotiation Trend",
      currentValue: negotiationTrend,
      previousValue: prior.negotiation_trend ?? null,
      historicalTrend: priorTrend.negotiation_trend ?? [],
      lastUpdated: computedAt,
      unit: "ratio",
      confidence: pricingConfidence,
      formulaUsed: FORMULA_TEXT.negotiation_trend,
      formulaId: FORMULA_IDS.negotiation_trend,
      inputData: {
        quote_count: facts.quotes.length,
        trend_index: negotiationTrend,
      },
      missingInputs:
        negotiationTrend == null ? missing("quote_series_min_2") : [],
    }),
    buildCommercialMetric({
      key: "price_movement",
      label: "Price Movement",
      currentValue: priceMovement,
      previousValue: prior.price_movement ?? null,
      historicalTrend: priorTrend.price_movement ?? [],
      lastUpdated: computedAt,
      unit: "ratio",
      confidence: pricingConfidence,
      formulaUsed: FORMULA_TEXT.price_movement,
      formulaId: FORMULA_IDS.price_movement,
      inputData: {
        latest_quote: latestQuote,
        prior_quote: priorQuote,
      },
      missingInputs: priceMovement == null ? missing("prior_quote") : [],
    }),
  ];

  const evidenceCoverage = commercialEvidenceCoverage({
    campaignCount,
    publicationCount: facts.publications.length,
    quoteCount: facts.quotes.length,
    monthCount: facts.historicalMonths.length,
  });

  const guardedMetrics = metrics.map((metric) => {
    const percent = clampConfidenceToEvidence(
      metric.confidence.percent,
      evidenceCoverage.percent
    );
    return {
      ...metric,
      confidence: {
        ...metric.confidence,
        percent,
        reason:
          percent != null &&
          metric.confidence.percent != null &&
          percent < metric.confidence.percent
            ? `${metric.confidence.reason} Capped by Evidence Coverage ${evidenceCoverage.percent}%.`
            : metric.confidence.reason,
      },
      explainability: {
        ...metric.explainability,
        confidence: percent,
      },
    };
  });

  const commercialHealth = computeCommercialHealth(guardedMetrics);
  const investmentReadiness = computeInvestmentReadiness({
    metrics: guardedMetrics,
    campaignCount,
  });

  return {
    influencerId: facts.influencerId,
    platform: facts.platform,
    currencyCode,
    computedAt,
    metrics: guardedMetrics,
    commercialHealth,
    investmentReadiness,
    evidenceCoverage,
    aiHints: buildAiHints(
      guardedMetrics,
      commercialHealth.level,
      investmentReadiness.status
    ),
    consumers: COMMERCIAL_INTELLIGENCE_CONSUMERS,
  };
}
