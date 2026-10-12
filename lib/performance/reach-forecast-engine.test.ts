import assert from "node:assert/strict";

import {
  mergeCollectedMetrics,
  storedReachContextFromPublication,
  stripReachFromCollectedMetrics,
} from "@/lib/performance/metrics-collector/merge-metrics";
import {
  computeReachForecast,
  reachMultiplierForContentType,
  resolveReachSnapshot,
} from "@/lib/performance/reach-forecast-engine";

// Multipliers
assert.equal(reachMultiplierForContentType("instagram", "instagram_post"), 0.3);
assert.equal(reachMultiplierForContentType("instagram", "instagram_reel"), 0.45);
assert.equal(reachMultiplierForContentType("tiktok", "tiktok_video"), 0.55);
assert.equal(reachMultiplierForContentType("instagram", "instagram_story"), 0.12);
assert.equal(reachMultiplierForContentType("instagram", "carousel"), 0.28);

// Forecast from followers
{
  const result = computeReachForecast({
    followers: 100_000,
    platform: "instagram",
    publication_type: "instagram_post", views:40_000, likes:1000,
  });
  assert.equal(result.forecastReach, 32_000);
  assert.equal(result.method, "delivery_estimate");
  assert.equal(result.confidence, "low");
}

// No followers → null forecast
{
  const result = computeReachForecast({
    followers: null,
    platform: "instagram",
    publication_type: "instagram_post",
  });
  assert.equal(result.forecastReach, null);
}

// Provider reach wins
{
  const snap = resolveReachSnapshot({
    providerReach: 42_000,
    followers: 100_000,
    platform: "instagram",
    publication_type: "instagram_post",
    storedReachSource: "forecast",
    storedForecastReach: 30_000,
    storedReach: 30_000,
  });
  assert.equal(snap.reach_source, "actual");
  assert.equal(snap.reach, 42_000);
  assert.equal(snap.actual_reach, 42_000);
  assert.equal(snap.forecast_reach, 30_000);
}

// Forecast when provider missing
{
  const snap = resolveReachSnapshot({
    providerReach: null,
    followers: 50_000,
    platform: "instagram",
    publication_type: "instagram_reel", views:25_000, likes:100,
  });
  assert.equal(snap.reach_source, "forecast");
  assert.equal(snap.reach, 20_000);
  assert.equal(snap.forecast_reach, 20_000);
}

// Manual import
{
  const snap = resolveReachSnapshot({
    manualReach: 9_999,
    isManualSource: true,
    followers: 100_000,
    platform: "instagram",
    publication_type: "instagram_post",
  });
  assert.equal(snap.reach_source, "manual");
  assert.equal(snap.reach, 9_999);
}

// Merge integration: forecast then actual
{
  const forecasted = mergeCollectedMetrics(
    {},
    { views:37500, likes: 100, comments: 10 },
    {
      followers: 100_000,
      platform: "instagram",
      publication_type: "instagram_post",
    }
  );
  assert.equal(forecasted.reach_source, "forecast");
  assert.equal(forecasted.reach, 30_000);

  const actualized = mergeCollectedMetrics(
    forecasted,
    { reach: 45_000, likes: 100, comments: 10 },
    {
      followers: 100_000,
      platform: "instagram",
      publication_type: "instagram_post",
      reach_source: "forecast",
      stored_forecast_reach: 30_000,
      stored_reach: 30_000,
      metrics_source: "apify",
    }
  );
  assert.equal(actualized.reach_source, "actual");
  assert.equal(actualized.reach, 45_000);
  assert.equal(actualized.forecast_reach, 30_000);
}

// Migration default reach_source=actual without reach is not treated as actual
{
  const ctx = storedReachContextFromPublication({
    reach_source: "actual",
    reach: null,
    actual_reach: null,
  });
  assert.equal(ctx.reach_source, null);
}

// Double merge in collector+persist must not label forecast as actual
{
  const stored = { reach: null, reach_source: "actual" };
  const reachCtx = storedReachContextFromPublication(stored);
  const mergeCtx = {
    platform: "instagram",
    publication_type: "instagram_post",
    followers: 71674,
    metrics_source: "apify" as const,
    ...reachCtx,
  };
  const collectorMerged = mergeCollectedMetrics(
    stored,
    { views: 557424, likes: 47521, comments: 329 },
    mergeCtx
  );
  assert.equal(collectorMerged.reach_source, "forecast");

  const persistMerged = mergeCollectedMetrics(
    stored,
    stripReachFromCollectedMetrics(collectorMerged),
    mergeCtx
  );
  assert.equal(persistMerged.reach_source, "forecast");
  assert.equal(persistMerged.actual_reach, null);
  assert.equal(persistMerged.forecast_reach, 445_939);
}

console.log("reach-forecast-engine tests passed");
