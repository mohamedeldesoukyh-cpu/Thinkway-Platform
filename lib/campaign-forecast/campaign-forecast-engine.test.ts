import assert from "node:assert/strict";

import {
  applyCampaignAudienceOverlap,
  computeCampaignForecast,
  deliverableDecayMultiplier,
  explainCreatorForecastStepByStep,
  strategySelectionMatrix,
} from "./index";

{
  const forecast = computeCampaignForecast({
    creators: [
      {
        creatorKey: "c1",
        followers: 100_000,
        platform: "instagram",
        engagementRate: 4.5,
        deliverables: [{ contentType: "instagram_reel", quantity: 1 }],
      },
    ],
  });

  assert.equal(forecast.assumptions.calculationMethod, "forecast_engine_v3");
  assert.equal(forecast.audienceSize, 100_000);
  assert.equal(forecast.grossReach, forecast.estimatedReach);
  assert.ok(forecast.estimatedImpressions > 0);
}

{
  const forecast = computeCampaignForecast({
    creators: [
      {
        creatorKey: "a",
        followers: 500_000,
        platform: "instagram",
        countryCode: "EG",
        categories: ["beauty"],
        niche: "beauty",
        deliverables: [{ contentType: "instagram_reel", quantity: 1 }],
      },
      {
        creatorKey: "b",
        followers: 300_000,
        platform: "instagram",
        countryCode: "EG",
        categories: ["beauty"],
        niche: "beauty",
        deliverables: [{ contentType: "instagram_reel", quantity: 1 }],
      },
    ],
  });

  assert.equal(forecast.grossReach, forecast.creatorForecasts[0]!.estimatedReach + forecast.creatorForecasts[1]!.estimatedReach);
  assert.ok(forecast.overlapDeduction > 0, "overlap should reduce net reach");
  assert.ok(forecast.estimatedReach < forecast.grossReach);
  assert.ok(forecast.explanation.some((line) => line.toLowerCase().includes("overlap")));
}

{
  const generic = computeCampaignForecast({
    creators: [{ creatorKey: "g1", followers: 50_000, platform: "instagram" }],
  });
  const historical = computeCampaignForecast({
    creators: [
      {
        creatorKey: "h1",
        followers: 50_000,
        platform: "instagram",
        historicalPerformance: {
          avgReachByContentType: { instagram_post: 28_000 },
          sampleSize: 15,
          source: "recent_publications",
        },
      },
    ],
  });

  assert.ok(
    historical.estimatedReach >= generic.estimatedReach * 0.5,
    "historical strategy should produce a distinct reach estimate"
  );
  assert.equal(
    historical.creatorForecasts[0]?.primaryForecastStrategy,
    "historical_performance"
  );
}

{
  const single = deliverableDecayMultiplier("instagram_reel", 1);
  const triple = deliverableDecayMultiplier("instagram_reel", 3);
  assert.equal(single, 1);
  assert.ok(triple > single);
  assert.ok(triple < 3, "diminishing returns — not linear ×3");
}

{
  const overlap = applyCampaignAudienceOverlap({
    creatorInputs: [
      { creatorKey: "a", followers: 500_000, platform: "instagram", countryCode: "EG" },
      { creatorKey: "b", followers: 300_000, platform: "instagram", countryCode: "EG" },
    ],
    creatorReachByKey: new Map([
      ["a", 500_000],
      ["b", 300_000],
    ]),
    config: {
      defaultPairOverlapRate: 0.08,
      maxPairOverlapRate: 0.45,
      defaultCampaignOverlapPerCreator: 0.05,
    },
  });

  assert.equal(overlap.grossReach, 800_000);
  assert.ok(overlap.overlapDeduction > 0);
  assert.equal(overlap.estimatedReach, Math.max(500_000, overlap.grossReach - overlap.overlapDeduction));
}

{
  assert.ok(strategySelectionMatrix().length >= 4);
  const forecast = computeCampaignForecast({
    creators: Array.from({ length: 10 }, (_, index) => ({
      creatorKey: `creator-${index + 1}`,
      followers: (index + 1) * 10_000,
      platform: index % 2 === 0 ? "instagram" : "tiktok",
      engagementRate: 3 + index * 0.2,
      countryCode: "EG",
      categories: ["beauty"],
    })),
  });
  const steps = explainCreatorForecastStepByStep(forecast, "creator-1");
  assert.ok(steps.some((line) => line.includes("strategy")));
  assert.ok(forecast.confidenceScore.deductions.length + forecast.confidenceScore.bonuses.length > 0);
}

console.log("campaign-forecast-engine.test.ts passed");
