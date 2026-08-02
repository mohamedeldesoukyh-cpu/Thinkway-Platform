import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeCreatorAudienceIntelligence,
  type CreatorAudienceFacts,
} from "@/lib/enterprise-creator-intelligence/audience/compute";
import {
  computeCreatorCategoryBrandIntelligence,
  type CreatorCategoryBrandFacts,
} from "@/lib/enterprise-creator-intelligence/category-brand/compute";
import type { CategoryBrandPostFact } from "@/lib/enterprise-creator-intelligence/category-brand/classify";
import {
  computeCreatorCommercialIntelligence,
  type CreatorCommercialFacts,
} from "@/lib/enterprise-creator-intelligence/commercial/compute";
import type { CreatorMonthlyMetrics } from "@/lib/enterprise-creator-intelligence/historical/types";
import {
  classifyInvestmentRecommendation,
  computeWeightedOverallScore,
  mapAudienceQuality,
  mapCommercialHealthLevel,
  mapPerformanceReliability,
} from "@/lib/enterprise-creator-intelligence/investment";
import {
  computeCreatorInvestmentIntelligence,
  type CreatorInvestmentFacts,
} from "@/lib/enterprise-creator-intelligence/investment/compute";
import { INVESTMENT_CONSUMERS } from "@/lib/enterprise-creator-intelligence/investment/types";
import {
  computeCreatorPerformanceIntelligence,
  type CreatorPerformanceFacts,
  type PerformancePublicationFact,
} from "@/lib/enterprise-creator-intelligence/performance/compute";

function month(
  periodMonth: string,
  followers: number,
  growth: number | null,
  diff: number | null
): CreatorMonthlyMetrics {
  return {
    influencerId: "inf-inv-1",
    platform: "instagram",
    periodMonth,
    followers,
    following: 100,
    postsCount: 50,
    avgViews: 1000,
    medianViews: 900,
    engagementRate: 2,
    postingFrequencyPerWeek: 2,
    monthlyGrowthRate: growth,
    followerDifference: diff,
    sampleCaptureCount: 1,
    source: "test",
    computedAt: `${periodMonth}T00:00:00.000Z`,
  };
}

function audienceFacts(): CreatorAudienceFacts {
  return {
    influencerId: "inf-inv-1",
    platform: "instagram",
    computedAt: "2026-08-02T00:00:00.000Z",
    demographics: {
      genderMale: 0.4,
      genderFemale: 0.55,
      genderUnknown: 0.05,
      age13_17: 0.05,
      age18_24: 0.35,
      age25_34: 0.4,
      age35_44: 0.15,
      age45_54: 0.05,
      age55Plus: null,
      topCountries: [
        { code: "EG", name: "Egypt", percent: 62 },
        { code: "SA", name: "Saudi Arabia", percent: 18 },
      ],
      topCities: [{ name: "Cairo", percent: 28 }],
      demographicSource: "modash",
      languages: ["ar", "en"],
      authenticityScore: 82,
    },
    monthlyMetrics: [
      month("2026-02-01", 100_000, null, null),
      month("2026-03-01", 102_000, 0.02, 2000),
      month("2026-04-01", 103_000, 0.01, 1000),
      month("2026-05-01", 104_000, 0.01, 1000),
      month("2026-06-01", 105_000, 0.01, 1000),
      month("2026-07-01", 107_000, 0.019, 2000),
    ],
    engagement: {
      shareTrend: "Improving",
      saveTrend: "Stable",
      interactionTrend: "Improving",
      engagementTrend: "Stable",
      stabilityHint: "Stable",
    },
  };
}

function commercialFacts(): CreatorCommercialFacts {
  return {
    influencerId: "inf-inv-1",
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
      { cost: 2000, currency: "EGP", quotedAt: "2026-07-01T00:00:00.000Z" },
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
  };
}

function post(overrides: Partial<CategoryBrandPostFact>): CategoryBrandPostFact {
  return {
    caption: null,
    hashtags: [],
    mentions: [],
    postedAt: "2026-07-15T00:00:00.000Z",
    url: "https://instagram.com/p/abc",
    isVideo: false,
    productType: null,
    mediaType: null,
    type: null,
    campaignType: null,
    ...overrides,
  };
}

function categoryFacts(): CreatorCategoryBrandFacts {
  return {
    influencerId: "inf-inv-1",
    platform: "instagram",
    computedAt: "2026-08-02T00:00:00.000Z",
    posts: [
      post({
        caption: "Exploring Tokyo #travel with @japanairlines",
        hashtags: ["travel"],
        mentions: ["japanairlines"],
        postedAt: "2026-07-20T00:00:00.000Z",
        url: "https://instagram.com/reel/1",
        productType: "clips",
        isVideo: true,
      }),
      post({
        caption: "Airport lounge lifestyle #travel #lifestyle #ad",
        hashtags: ["travel", "lifestyle", "ad"],
        mentions: ["japanairlines"],
        postedAt: "2026-07-10T00:00:00.000Z",
        campaignType: "reel",
      }),
      post({
        caption: "Mountain road trip #travel",
        hashtags: ["travel"],
        postedAt: "2026-03-01T00:00:00.000Z",
      }),
      post({
        caption: "Travel diary #travel",
        hashtags: ["travel"],
        postedAt: "2026-06-01T00:00:00.000Z",
      }),
    ],
  };
}

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

function performanceFacts(): CreatorPerformanceFacts {
  return {
    influencerId: "inf-inv-1",
    platform: "instagram",
    computedAt: "2026-08-02T00:00:00.000Z",
    publications: [
      pub({
        postedAt: "2026-07-20T00:00:00.000Z",
        views: 20_000,
        source: "campaign",
        cost: 2000,
        currency: "EGP",
        campaignHeaderId: "camp-1",
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
    ],
    attributedRevenue: 50_000,
    avgQuotedCost: 5_000,
  };
}

function richInvestmentFacts(): CreatorInvestmentFacts {
  const commercial = computeCreatorCommercialIntelligence(commercialFacts());
  const categoryBrand = computeCreatorCategoryBrandIntelligence(categoryFacts());
  const performance = computeCreatorPerformanceIntelligence(performanceFacts());
  const audience = computeCreatorAudienceIntelligence(audienceFacts());
  return {
    influencerId: "inf-inv-1",
    platform: "instagram",
    computedAt: "2026-08-02T00:00:00.000Z",
    historicalMonthly: audienceFacts().monthlyMetrics,
    commercial,
    categoryBrand,
    performance,
    audience,
  };
}

describe("Enterprise Creator Intelligence — Investment Sprint 6", () => {
  it("maps layer classifications without inventing black-box scores", () => {
    assert.equal(mapCommercialHealthLevel("Excellent"), 95);
    assert.equal(mapPerformanceReliability("Reliable"), 80);
    assert.equal(mapAudienceQuality("High Quality"), 92);
    assert.equal(mapAudienceQuality("Unknown"), null);
  });

  it("computes weighted score, explainable dimensions, recommendation, risks, opportunities", () => {
    const result = computeCreatorInvestmentIntelligence(richInvestmentFacts());

    assert.equal(result.dimensions.length, 13);
    for (const dim of result.dimensions) {
      assert.ok(dim.label.length > 0);
      assert.ok(dim.weight > 0);
      assert.ok(dim.explanation.length > 0);
      assert.ok(dim.explainability.meaning.length > 0);
      assert.ok(dim.explainability.reason.length > 0);
      assert.ok(dim.source.collectionMethod.length > 0);
      assert.ok(Array.isArray(dim.supportingEvidence));
      assert.ok(Array.isArray(dim.explainability.missingInputs));
    }

    const weightSum = result.dimensions.reduce((s, d) => s + d.weight, 0);
    assert.ok(Math.abs(weightSum - 1) < 0.001);

    assert.ok(result.overallScore != null);
    assert.equal(
      result.overallScore,
      computeWeightedOverallScore(result.dimensions)
    );

    assert.ok(result.recommendation.recommendation);
    assert.ok(result.recommendation.why.length > 0);
    assert.ok(result.recommendation.confidence.percent != null);
    assert.ok(result.recommendation.confidence.basedOn.length > 0);
    assert.ok(result.recommendation.basedOnLayers.length >= 4);
    assert.ok(result.recommendation.explainability.evidence.length > 0);

    assert.ok(Array.isArray(result.risks));
    assert.ok(Array.isArray(result.opportunities));
    for (const risk of result.risks) {
      assert.ok(risk.severity);
      assert.ok(risk.explanation.length > 0);
      assert.ok(risk.suggestedAction.length > 0);
    }
    for (const opp of result.opportunities) {
      assert.ok(opp.explanation.length > 0);
      assert.ok(opp.evidence.length > 0);
    }

    assert.ok(result.businessReadiness.planningWorkspace.includes("Planning"));
    assert.ok(result.businessReadiness.clientWorkspace.includes("Client"));
    assert.ok(result.businessReadiness.campaignWorkspace.includes("Campaign"));
    assert.equal(
      result.businessReadiness.overall,
      result.recommendation.recommendation
    );

    assert.equal(result.layerCoverage.commercial, true);
    assert.equal(result.layerCoverage.audience, true);
    assert.equal(result.layerCoverage.performance, true);
    assert.equal(result.layerCoverage.categoryBrand, true);
    assert.equal(result.layerCoverage.historical, true);

    assert.deepEqual([...result.consumers], [...INVESTMENT_CONSUMERS]);
    assert.equal(result.aiHints.available, true);
    assert.ok(result.aiHints.explainWhyRecommended.length > 0);
    assert.ok(result.aiHints.explainConfidenceDrivers.length > 0);
    assert.ok(result.aiHints.suggestBusinessActions.length > 0);
    assert.ok(result.source.collectionMethod.includes("Sprint 1–5"));
    assert.ok(result.evidenceCoverage);
    assert.ok(result.evidenceCoverage.percent != null);
    if (
      result.recommendation.confidence.percent != null &&
      result.evidenceCoverage.percent != null
    ) {
      assert.ok(
        result.recommendation.confidence.percent <=
          result.evidenceCoverage.percent
      );
    }
  });

  it("returns Insufficient Data when layers are missing", () => {
    const result = computeCreatorInvestmentIntelligence({
      influencerId: "inf-empty",
      platform: null,
      computedAt: "2026-08-02T00:00:00.000Z",
      historicalMonthly: null,
      commercial: null,
      categoryBrand: null,
      performance: null,
      audience: null,
    });

    assert.equal(result.recommendation.recommendation, "Insufficient Data");
    assert.equal(result.overallScore, null);
    assert.ok(result.risks.some((r) => r.key === "missing_data" || r.key === "limited_commercial_data"));
    assert.equal(result.aiHints.recommendRefresh, true);
    assert.equal(result.layerCoverage.commercial, false);
  });

  it("classifies recommendation thresholds with explanations", () => {
    const high = classifyInvestmentRecommendation({
      overallScore: 88,
      confidencePercent: 90,
      risks: [],
      scoredDimensionCount: 12,
    });
    assert.equal(high.recommendation, "Highly Recommended");
    assert.ok(high.why.includes("88"));

    const risk = classifyInvestmentRecommendation({
      overallScore: 70,
      confidencePercent: 80,
      risks: [
        {
          key: "x",
          label: "Critical gap",
          severity: "Critical",
          explanation: "x",
          suggestedAction: "y",
          evidence: [],
        },
      ],
      scoredDimensionCount: 12,
    });
    assert.equal(risk.recommendation, "High Risk");
  });

  it("does not duplicate layer engines — consumes precomputed intelligence only", () => {
    const facts = richInvestmentFacts();
    const commercialCpm = facts.commercial!.metrics.find((m) => m.key === "cpm")!;
    const result = computeCreatorInvestmentIntelligence(facts);
    const efficiency = result.dimensions.find(
      (d) => d.key === "commercial_efficiency"
    )!;
    assert.ok(efficiency.source.collectionMethod.includes("Sprint 2"));
    assert.ok(commercialCpm.currentValue != null);
    assert.ok(
      efficiency.supportingEvidence.some((e) => e.includes("Commercial health"))
    );
  });
});
