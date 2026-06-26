import assert from "node:assert/strict";

import {
  mergeCollectedMetrics,
  storedImpressionsContextFromPublication,
  stripImpressionsFromCollectedMetrics,
} from "@/lib/performance/metrics-collector/merge-metrics";
import {
  computeImpressionsForecast,
  resolveImpressionsSnapshot,
} from "@/lib/performance/impressions-forecast-engine";

// IG Reel: views × 1.15
{
  const result = computeImpressionsForecast({
    platform: "instagram",
    publication_type: "instagram_reel",
    views: 100_000,
  });
  assert.equal(result.forecastImpressions, 115_000);
  assert.equal(result.formula, "views × 1.15");
}

// IG Post: reach × 1.25 (including forecast reach)
{
  const result = computeImpressionsForecast({
    platform: "instagram",
    publication_type: "instagram_post",
    effectiveReach: 40_000,
  });
  assert.equal(result.forecastImpressions, 50_000);
  assert.equal(result.formula, "reach × 1.25");
}

// TikTok: views × 1.10
{
  const result = computeImpressionsForecast({
    platform: "tiktok",
    publication_type: "tiktok_video",
    views: 10_000,
  });
  assert.equal(result.forecastImpressions, 11_000);
  assert.equal(result.formula, "views × 1.10");
}

// Provider impressions win
{
  const snap = resolveImpressionsSnapshot({
    providerImpressions: 88_000,
    views: 100_000,
    platform: "instagram",
    publication_type: "instagram_reel",
    storedImpressionsSource: "forecast",
    storedForecastImpressions: 115_000,
    storedImpressions: 115_000,
  });
  assert.equal(snap.impressions_source, "actual");
  assert.equal(snap.impressions, 88_000);
  assert.equal(snap.forecast_impressions, 115_000);
}

// Forecast when provider missing
{
  const snap = resolveImpressionsSnapshot({
    providerImpressions: null,
    views: 50_000,
    platform: "tiktok",
    publication_type: "tiktok_video",
  });
  assert.equal(snap.impressions_source, "forecast");
  assert.equal(snap.impressions, 55_000);
}

// Manual import
{
  const snap = resolveImpressionsSnapshot({
    manualImpressions: 12_345,
    isManualSource: true,
    views: 100_000,
    platform: "tiktok",
    publication_type: "tiktok_video",
  });
  assert.equal(snap.impressions_source, "manual");
  assert.equal(snap.impressions, 12_345);
}

// Merge integration
{
  const merged = mergeCollectedMetrics(
    {},
    { views: 100_000, likes: 100, comments: 10 },
    {
      platform: "instagram",
      publication_type: "instagram_reel",
    }
  );
  assert.equal(merged.impressions_source, "forecast");
  assert.equal(merged.impressions, 115_000);
}

// Migration default impressions_source=actual without impressions is not treated as actual
{
  const ctx = storedImpressionsContextFromPublication({
    impressions_source: "actual",
    impressions: null,
    actual_impressions: null,
  });
  assert.equal(ctx.impressions_source, null);
}

// Double merge must not label forecast as actual
{
  const stored = { impressions: null, impressions_source: "actual" };
  const impressionsCtx = storedImpressionsContextFromPublication(stored);
  const mergeCtx = {
    platform: "tiktok",
    publication_type: "tiktok_video",
    metrics_source: "apify" as const,
    ...impressionsCtx,
  };
  const collectorMerged = mergeCollectedMetrics(
    stored,
    { views: 10_000, likes: 100, comments: 10 },
    mergeCtx
  );
  assert.equal(collectorMerged.impressions_source, "forecast");
  assert.equal(collectorMerged.impressions, 11_000);

  const persistMerged = mergeCollectedMetrics(
    stored,
    stripImpressionsFromCollectedMetrics(collectorMerged),
    mergeCtx
  );
  assert.equal(persistMerged.impressions_source, "forecast");
  assert.equal(persistMerged.actual_impressions, null);
  assert.equal(persistMerged.forecast_impressions, 11_000);
}

console.log("impressions-forecast-engine tests passed");
