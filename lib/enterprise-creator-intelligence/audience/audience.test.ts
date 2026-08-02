import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyAudienceQuality,
  classifyAudienceStability,
  classifyGrowthTrend,
  detectSpikesAndDrops,
} from "@/lib/enterprise-creator-intelligence/audience/classify";
import {
  computeCreatorAudienceIntelligence,
  type CreatorAudienceFacts,
} from "@/lib/enterprise-creator-intelligence/audience/compute";
import { AUDIENCE_CONSUMERS } from "@/lib/enterprise-creator-intelligence/audience/types";
import type { CreatorMonthlyMetrics } from "@/lib/enterprise-creator-intelligence/historical/types";

function month(
  periodMonth: string,
  followers: number,
  growth: number | null,
  diff: number | null
): CreatorMonthlyMetrics {
  return {
    influencerId: "inf-aud-1",
    platform: "instagram",
    periodMonth,
    followers,
    following: 100,
    postsCount: 50,
    avgViews: 1000,
    medianViews: 900,
    engagementRate: 2,
    postingFrequencyPerWeek: 1,
    monthlyGrowthRate: growth,
    followerDifference: diff,
    sampleCaptureCount: 1,
    source: "test",
    computedAt: `${periodMonth}T00:00:00.000Z`,
  };
}

function baseFacts(overrides?: Partial<CreatorAudienceFacts>): CreatorAudienceFacts {
  return {
    influencerId: "inf-aud-1",
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
        { code: "AE", name: "United Arab Emirates", percent: 10 },
      ],
      topCities: [
        { name: "Cairo", percent: 28 },
        { name: "Alexandria", percent: 12 },
      ],
      demographicSource: "modash",
      languages: ["ar", "en"],
      authenticityScore: 82,
    },
    monthlyMetrics: [
      month("2026-02-01", 100_000, null, null),
      month("2026-03-01", 102_000, 0.02, 2000),
      month("2026-04-01", 103_000, 0.01, 1000),
      month("2026-05-01", 120_000, 0.165, 17_000),
      month("2026-06-01", 118_000, -0.0167, -2000),
      month("2026-07-01", 121_000, 0.0254, 3000),
    ],
    engagement: {
      shareTrend: "Improving",
      saveTrend: "Stable",
      interactionTrend: "Improving",
      engagementTrend: "Stable",
      stabilityHint: "Stable",
    },
    ...overrides,
  };
}

describe("Enterprise Creator Intelligence — Audience Sprint 5", () => {
  it("classifies growth, quality, spikes/drops, and stability", () => {
    assert.equal(classifyGrowthTrend({ growthRates: [0.02, 0.03], latestGrowth: 0.03 }), "Growing");
    assert.equal(classifyGrowthTrend({ growthRates: [0.2], latestGrowth: 0.2 }), "Spike");
    assert.equal(classifyGrowthTrend({ growthRates: [-0.2], latestGrowth: -0.2 }), "Drop");

    const quality = classifyAudienceQuality({
      demographicSource: "modash",
      hasGender: true,
      hasAge: true,
      hasCountries: true,
      authenticityScore: 82,
    });
    assert.equal(quality.level, "High Quality");

    const { spikes, drops } = detectSpikesAndDrops([
      { at: "2026-05-01", growthRate: 0.165 },
      { at: "2026-06-01", growthRate: -0.2 },
    ]);
    assert.equal(spikes.length, 1);
    assert.equal(drops.length, 1);

    assert.equal(
      classifyAudienceStability({
        followerSeries: [100, 101, 102, 103],
        postedAts: [
          "2026-01-01T00:00:00.000Z",
          "2026-02-01T00:00:00.000Z",
          "2026-03-01T00:00:00.000Z",
          "2026-04-01T00:00:00.000Z",
        ],
        growthRates: [0.01, 0.01, 0.01],
      }).level,
      "Highly Stable"
    );
  });

  it("computes demographics, growth windows, geography, language, readiness", () => {
    const result = computeCreatorAudienceIntelligence(baseFacts());

    assert.ok(result.windows.last_30_days);
    assert.ok(result.windows.last_90_days);
    assert.ok(result.windows.last_180_days);
    assert.ok(result.windows.lifetime);

    const lifetime = result.windows.lifetime;
    assert.ok(lifetime.demographics.gender.some((g) => g.percent != null));
    assert.ok(lifetime.demographics.age.some((a) => a.percent != null));
    assert.ok(lifetime.demographics.explainability.meaning.length > 0);
    assert.ok(lifetime.growth.suddenSpikes.length >= 1);
    assert.ok(lifetime.growth.explainability.evidence.length > 0);

    assert.equal(result.quality.level, "High Quality");
    assert.equal(result.quality.fakeFollowerEstimation.available, false);
    assert.ok(result.stability.level);
    assert.equal(result.geography.primaryCountries[0], "Egypt");
    assert.equal(result.languages.primary, "ar");
    assert.ok(result.languages.secondary.includes("en"));
    assert.equal(result.engagementBehaviour.shareBehaviour, "Improving");
    assert.equal(result.engagementBehaviour.returningEngagement, "Unavailable");
    assert.equal(result.businessReadiness.commercialAudienceReadiness, "Ready");
    assert.deepEqual([...result.consumers], [...AUDIENCE_CONSUMERS]);
    assert.equal(result.aiHints.available, true);
    assert.ok(result.source.collectionMethod.length > 0);
  });

  it("exposes missing inputs and unknown quality when demographics absent", () => {
    const result = computeCreatorAudienceIntelligence(
      baseFacts({
        demographics: {
          genderMale: null,
          genderFemale: null,
          genderUnknown: null,
          age13_17: null,
          age18_24: null,
          age25_34: null,
          age35_44: null,
          age45_54: null,
          age55Plus: null,
          topCountries: null,
          topCities: null,
          demographicSource: "unavailable",
          languages: [],
          authenticityScore: null,
        },
        monthlyMetrics: [],
        engagement: {
          shareTrend: null,
          saveTrend: null,
          interactionTrend: null,
          engagementTrend: null,
          stabilityHint: null,
        },
      })
    );

    assert.equal(result.quality.level, "Unknown");
    assert.ok(
      result.windows.lifetime.demographics.missingInputs.includes(
        "gender_distribution"
      )
    );
    assert.equal(
      result.businessReadiness.commercialAudienceReadiness,
      "Needs Demographics"
    );
    assert.equal(result.aiHints.recommendRefresh, true);
  });
});
