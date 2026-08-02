import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STANDARD_METRIC_FIELDS,
  assertStandardMetricShape,
} from "@/lib/enterprise-creator-intelligence/commercial/build-metric";
import { computeCommercialConfidence } from "@/lib/enterprise-creator-intelligence/commercial/confidence";
import {
  computeCreatorCommercialIntelligence,
  type CreatorCommercialFacts,
} from "@/lib/enterprise-creator-intelligence/commercial/compute";
import {
  FORMULA_TEXT,
  computeCommercialCpe,
  computeCommercialCpm,
  computeCommercialEmv,
  computeCommercialRoi,
  computeCostPerDeliverable,
  computeImpliedBenchmarkCpm,
  computePriceMovementRatio,
  negotiationTrendFromSeries,
} from "@/lib/enterprise-creator-intelligence/commercial/formulas";
import { classifyBusinessTrend } from "@/lib/enterprise-creator-intelligence/commercial/trend";
import {
  COMMERCIAL_INTELLIGENCE_CONSUMERS,
} from "@/lib/enterprise-creator-intelligence/commercial/types";
import { COMMERCIAL_METRIC_SOURCES } from "@/lib/enterprise-creator-intelligence/commercial/sources";

function baseFacts(overrides?: Partial<CreatorCommercialFacts>): CreatorCommercialFacts {
  return {
    influencerId: "inf-1",
    platform: "instagram",
    computedAt: "2026-08-02T00:00:00.000Z",
    publications: [
      {
        cost: 1000,
        currency: "EGP",
        impressions: 100_000,
        views: 80_000,
        reach: 60_000,
        forecastReach: 55_000,
        likes: 4000,
        comments: 200,
        shares: 100,
        saves: 50,
        engagements: 4350,
        publishedAt: "2026-06-01T00:00:00.000Z",
        campaignHeaderId: "camp-1",
      },
      {
        cost: 1000,
        currency: "EGP",
        impressions: 100_000,
        views: 90_000,
        reach: 70_000,
        forecastReach: 65_000,
        likes: 5000,
        comments: 250,
        shares: 120,
        saves: 80,
        engagements: 5450,
        publishedAt: "2026-07-01T00:00:00.000Z",
        campaignHeaderId: "camp-2",
      },
    ],
    assignments: [
      {
        costBeforeVat: 2000,
        currency: "EGP",
        deliverableCount: 4,
        campaignHeaderId: "camp-1",
        campaignLineId: "line-1",
      },
    ],
    attributedRevenue: 20_400,
    revenueCurrency: "EGP",
    quotes: [
      { cost: 1800, currency: "EGP", quotedAt: "2026-01-01T00:00:00.000Z" },
      { cost: 2000, currency: "EGP", quotedAt: "2026-04-01T00:00:00.000Z" },
      { cost: 2200, currency: "EGP", quotedAt: "2026-07-01T00:00:00.000Z" },
    ],
    historicalMonths: [
      {
        avgViews: 75_000,
        medianViews: 70_000,
        periodMonth: "2026-06-01",
        platform: "instagram",
      },
      {
        avgViews: 85_000,
        medianViews: 80_000,
        periodMonth: "2026-07-01",
        platform: "instagram",
      },
    ],
    ...overrides,
  };
}

describe("Enterprise Creator Intelligence — Commercial Sprint 2", () => {
  it("reuses platform CPM/CPE formulas", () => {
    assert.equal(computeCommercialCpm(2000, 200_000), 10);
    const cpe = computeCommercialCpe(2000, {
      impressions: 200_000,
      reach: 100_000,
      views: 160_000,
      likes: 9000,
      comments: 450,
      shares: 220,
      saves: 130,
      clicks: null,
      cost: 2000,
    });
    assert.ok(cpe != null && cpe > 0);
  });

  it("computes EMV, ROI, cost per deliverable, pricing movement", () => {
    const benchmark = computeImpliedBenchmarkCpm(2000, 80_000);
    assert.ok(benchmark != null);
    const emv = computeCommercialEmv(200_000, benchmark);
    assert.ok(emv != null && emv > 0);
    assert.equal(computeCommercialRoi(20_400, 2000), 9.2);
    assert.equal(computeCostPerDeliverable(2000, 4), 500);
    assert.equal(computePriceMovementRatio(2200, 2000), 0.1);
    const trend = negotiationTrendFromSeries([1800, 2000, 2200]);
    assert.ok(trend != null && trend > 0);
  });

  it("builds explainable confidence with based-on evidence", () => {
    const confidence = computeCommercialConfidence(
      {
        campaignCount: 28,
        monthCount: 14,
        engagementTotal: 3_100_000,
      },
      "roi"
    );
    assert.equal(confidence.percent, 100);
    assert.ok(confidence.basedOn.some((b) => b.label === "Campaigns"));
    assert.ok(confidence.basedOn.some((b) => b.label === "Months"));
    assert.ok(confidence.basedOn.some((b) => b.label === "Engagements"));
  });

  it("produces every commercial metric with source, formula, and confidence", () => {
    const result = computeCreatorCommercialIntelligence(baseFacts());
    const keys = result.metrics.map((m) => m.key);
    for (const key of Object.keys(COMMERCIAL_METRIC_SOURCES)) {
      assert.ok(keys.includes(key as never), `missing metric ${key}`);
    }

    const roi = result.metrics.find((m) => m.key === "roi")!;
    assert.equal(roi.currentValue, 9.2);
    assert.equal(roi.source.label, "Thinkway Campaign Results");
    assert.equal(roi.explainability.formula, FORMULA_TEXT.roi);
    assert.equal(roi.formula, FORMULA_TEXT.roi);
    assert.ok(roi.confidence.percent != null);
    assert.ok(roi.confidence.reason.length > 0);
    assert.ok(roi.confidence.basedOn.length > 0);

    const cpm = result.metrics.find((m) => m.key === "cpm")!;
    assert.equal(cpm.source.label, "Thinkway Commercial Data");
    assert.equal(cpm.currencyCode, "EGP");
    assert.equal(cpm.currentDisplay, "EGP 10.00");
    assert.ok(!cpm.currentDisplay?.includes("$"));
    assert.equal(cpm.source.system, "Thinkway Platform");
    assert.ok(cpm.source.collectionMethod.length > 0);

    const avgViews = result.metrics.find((m) => m.key === "average_views")!;
    assert.equal(avgViews.source.label, "Instagram Historical Metrics");
    assert.equal(avgViews.currentValue, 85_000);

    const pricing = result.metrics.find((m) => m.key === "historical_pricing")!;
    assert.equal(pricing.source.label, "Commercial Negotiation History");
    assert.ok(pricing.currentDisplay?.startsWith("EGP "));

    assert.equal(result.aiHints.metricsAvailable, true);
    assert.equal(result.aiHints.moneyMetricsReady, true);
    assert.ok(result.commercialHealth.level);
    assert.ok(result.investmentReadiness.status);
  });

  it("exposes previous values and never requires overwriting history inputs", () => {
    const result = computeCreatorCommercialIntelligence(
      baseFacts({
        priorMetrics: { roi: 8.0, cpm: 12 },
        priorTrend: {
          roi: [
            { at: "2026-06-01T00:00:00.000Z", value: 7.5 },
            { at: "2026-07-01T00:00:00.000Z", value: 8.0 },
          ],
        },
      })
    );
    const roi = result.metrics.find((m) => m.key === "roi")!;
    assert.equal(roi.previousValue, 8.0);
    assert.equal(roi.historicalTrend.length, 2);
    assert.equal(roi.trend.length, 2);
    assert.equal(roi.trendDirection, "up");
    assert.equal(roi.trendLabel, "Improving");
    assert.equal(roi.historicalSeriesAvailable, "Yes");
  });

  it("lists missing inputs when commercial data is absent", () => {
    const result = computeCreatorCommercialIntelligence(
      baseFacts({
        publications: [],
        assignments: [],
        attributedRevenue: null,
        quotes: [],
        historicalMonths: [],
      })
    );
    const cpm = result.metrics.find((m) => m.key === "cpm")!;
    assert.equal(cpm.currentValue, null);
    assert.ok(cpm.explainability.missingInputs.includes("cost"));
    assert.ok(cpm.explainability.missingInputs.includes("impressions"));
  });

  it("Product hardening: every metric uses the standard dashboard object", () => {
    const result = computeCreatorCommercialIntelligence(
      baseFacts({
        priorMetrics: { cpm: 12, roi: 8 },
        priorTrend: {
          cpm: [{ at: "2026-07-01T00:00:00.000Z", value: 12 }],
          roi: [{ at: "2026-07-01T00:00:00.000Z", value: 8 }],
        },
      })
    );

    for (const metric of result.metrics) {
      const missing = assertStandardMetricShape(metric);
      assert.deepEqual(missing, [], `${metric.key} missing ${missing.join(",")}`);
      for (const field of STANDARD_METRIC_FIELDS) {
        assert.notEqual(
          (metric as Record<string, unknown>)[field],
          undefined,
          `${metric.key}.${field}`
        );
      }
      assert.ok(metric.meaning.length > 0);
      assert.ok(metric.reason.length > 0);
      assert.ok(metric.businessContext.length > 0);
      assert.ok(metric.explainability.meaning.length > 0);
      assert.ok(
        metric.comparisons.current !== undefined &&
          metric.comparisons.previousMonth !== undefined &&
          metric.comparisons.previousQuarter !== undefined &&
          metric.comparisons.previousSixMonths !== undefined &&
          metric.comparisons.previousYear !== undefined &&
          metric.comparisons.lifetime !== undefined
      );
      assert.equal(metric.benchmarks.market.available, false);
      assert.equal(metric.benchmarks.category.available, false);
      assert.ok("creator" in metric.benchmarks);
      assert.ok("campaign" in metric.benchmarks);
      assert.ok("platform" in metric.benchmarks);
    }
  });

  it("Product hardening: trend labels, health, readiness, consumers", () => {
    assert.equal(classifyBusinessTrend("roi", "up"), "Improving");
    assert.equal(classifyBusinessTrend("cpm", "flat"), "Stable");
    assert.equal(classifyBusinessTrend("cpe", "up"), "Declining");
    assert.equal(classifyBusinessTrend("negotiation_trend", "up"), "Increasing");
    assert.equal(classifyBusinessTrend("price_movement", "flat"), "Stable");

    const result = computeCreatorCommercialIntelligence(
      baseFacts({
        priorMetrics: { cpm: 12, cpe: 0.3, roi: 8 },
      })
    );
    const cpm = result.metrics.find((m) => m.key === "cpm")!;
    assert.equal(cpm.trendLabel, "Improving"); // 10 < 12 lower-is-better
    assert.ok(
      ["Excellent", "Good", "Monitor", "Attention", "Critical"].includes(
        result.commercialHealth.level
      )
    );
    assert.ok(result.commercialHealth.dimensions.pricing);
    assert.ok(result.commercialHealth.dimensions.efficiency);
    assert.ok(result.commercialHealth.dimensions.performance);
    assert.ok(result.commercialHealth.dimensions.commercialStability);
    assert.ok(result.commercialHealth.dimensions.commercialConfidence);
    assert.ok(
      [
        "Commercial Ready",
        "Needs More Data",
        "Limited Confidence",
        "Historical Only",
        "Insufficient Campaign History",
      ].includes(result.investmentReadiness.status)
    );
    assert.deepEqual(
      [...result.consumers],
      [...COMMERCIAL_INTELLIGENCE_CONSUMERS]
    );
    assert.equal(result.aiHints.commercialHealth, result.commercialHealth.level);
    assert.equal(
      result.aiHints.investmentReadiness,
      result.investmentReadiness.status
    );
  });
});
