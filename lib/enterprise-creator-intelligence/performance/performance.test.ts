import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeCreatorPerformanceIntelligence,
  type CreatorPerformanceFacts,
  type PerformancePublicationFact,
} from "@/lib/enterprise-creator-intelligence/performance/compute";
import {
  classifyPerformanceTrend,
  classifyPublishingEffectiveness,
  classifyReliability,
  classifyStability,
} from "@/lib/enterprise-creator-intelligence/performance/trends";
import { PERFORMANCE_CONSUMERS } from "@/lib/enterprise-creator-intelligence/performance/types";

function pub(
  overrides: Partial<PerformancePublicationFact>
): PerformancePublicationFact {
  return {
    source: "organic",
    platform: "instagram",
    postedAt: "2026-07-01T00:00:00.000Z",
    views: 10_000,
    reach: 8_000,
    likes: 500,
    comments: 40,
    shares: 20,
    saves: 30,
    engagements: null,
    watchTimeSeconds: 12,
    completionRate: 0.45,
    impressions: 12_000,
    cost: null,
    currency: null,
    campaignHeaderId: null,
    ...overrides,
  };
}

function facts(
  publications: PerformancePublicationFact[],
  extra?: Partial<CreatorPerformanceFacts>
): CreatorPerformanceFacts {
  return {
    influencerId: "inf-perf-1",
    platform: "instagram",
    computedAt: "2026-08-02T00:00:00.000Z",
    publications,
    attributedRevenue: 50_000,
    avgQuotedCost: 5_000,
    ...extra,
  };
}

describe("Enterprise Creator Intelligence — Performance Sprint 4", () => {
  it("classifies trends, stability, publishing, and reliability", () => {
    assert.equal(classifyPerformanceTrend(120, 100, [100, 110, 120]), "Improving");
    assert.equal(classifyPerformanceTrend(100, 100, [100, 100, 100]), "Stable");
    assert.equal(classifyPerformanceTrend(80, 100, [100, 90, 80]), "Declining");
    assert.equal(classifyStability([100, 102, 98, 101]).level, "Highly Stable");
    assert.equal(
      classifyPublishingEffectiveness({
        postingFrequencyPerWeek: 2.5,
        sampleCount: 20,
        spanDays: 90,
      }),
      "High consistency"
    );
    assert.equal(
      classifyReliability({
        stability: "Stable",
        confidencePercent: 70,
        sampleCount: 12,
        trend: "Stable",
      }).level,
      "Reliable"
    );
  });

  it("computes historical windows with explainability and source attribution", () => {
    const result = computeCreatorPerformanceIntelligence(
      facts([
        pub({
          postedAt: "2026-07-20T00:00:00.000Z",
          views: 20_000,
          source: "campaign",
          cost: 2000,
          currency: "EGP",
          campaignHeaderId: "camp-1",
          watchTimeSeconds: 18,
          completionRate: 0.55,
        }),
        pub({
          postedAt: "2026-07-05T00:00:00.000Z",
          views: 15_000,
          source: "campaign",
          cost: 2000,
          campaignHeaderId: "camp-1",
        }),
        pub({ postedAt: "2026-05-01T00:00:00.000Z", views: 9_000 }),
        pub({ postedAt: "2026-03-01T00:00:00.000Z", views: 8_000 }),
        pub({ postedAt: "2025-12-01T00:00:00.000Z", views: 7_500 }),
        pub({
          postedAt: "2026-06-15T00:00:00.000Z",
          views: 12_000,
          shares: 40,
          saves: 60,
        }),
      ])
    );

    assert.ok(result.windows.last_30_days.sampleCount >= 1);
    assert.ok(result.windows.last_90_days);
    assert.ok(result.windows.last_180_days);
    assert.ok(result.windows.lifetime.sampleCount >= 6);

    const views = result.windows.lifetime.metrics.find((m) => m.key === "views")!;
    assert.ok(views.value != null);
    assert.ok(views.confidence.percent != null);
    assert.ok(views.explainability.meaning.length > 0);
    assert.ok(views.source.collectionMethod.length > 0);
    assert.ok(views.source.refreshTime);

    assert.ok(result.overallTrend);
    assert.ok(result.trendExplanation.whatChanged.length > 0);
    assert.ok(result.stability.level);
    assert.equal(result.audienceResponse.length, 6);
    assert.ok(result.publishingEffectiveness.level);
    assert.ok(result.campaignPerformance.campaignViews != null);
    assert.ok(result.campaignPerformance.campaignRoi != null);
    assert.ok(result.reliability.why.length > 0);
    assert.equal(result.forecastReadiness.predictionExtension.available, false);
    assert.ok(result.planningReadiness.campaignPerformanceAvailable);
    assert.deepEqual([...result.consumers], [...PERFORMANCE_CONSUMERS]);
    assert.equal(result.aiHints.available, true);
  });

  it("marks watch/completion missing when unavailable", () => {
    const result = computeCreatorPerformanceIntelligence(
      facts([
        pub({
          watchTimeSeconds: null,
          completionRate: null,
          postedAt: "2026-07-01T00:00:00.000Z",
        }),
      ])
    );
    const watch = result.windows.lifetime.metrics.find((m) => m.key === "watch_time")!;
    const completion = result.windows.lifetime.metrics.find(
      (m) => m.key === "completion_rate"
    )!;
    assert.equal(watch.value, null);
    assert.ok(watch.explainability.missingInputs.length > 0);
    assert.equal(completion.value, null);
  });

  it("handles empty history with refresh recommendation", () => {
    const result = computeCreatorPerformanceIntelligence(facts([]));
    assert.equal(result.aiHints.recommendRefresh, true);
    assert.equal(result.overallTrend, "Unknown");
    assert.equal(result.reliability.level, "Low Confidence");
    assert.ok(
      result.campaignPerformance.missingInputs.includes("campaign_publications")
    );
  });
});
