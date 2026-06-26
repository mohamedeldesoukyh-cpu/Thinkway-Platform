import assert from "node:assert/strict";

import {
  computeEngagementRate,
  computeEngagementSnapshot,
  computeEngagements,
  isInstagramHiddenLikes,
  isInstagramPhotoOrCarousel,
  metricsRefreshStatusForEngagement,
  metricsSourceBadge,
} from "@/lib/performance/engagement-rate-engine";
import { mergeCollectedMetrics } from "@/lib/performance/metrics-collector/merge-metrics";

// ER from views
{
  const result = computeEngagementRate({
    views: 1000,
    likes: 20,
    comments: 5,
    shares: 0,
    saves: 0,
  });
  assert.equal(result.engagement_rate_method, "views");
  assert.equal(result.engagement_rate, 2.5);
}

// ER from reach when views missing
{
  const result = computeEngagementRate({
    reach: 500,
    likes: 10,
    comments: 0,
    shares: 0,
    saves: 0,
  });
  assert.equal(result.engagement_rate_method, "reach");
  assert.equal(result.engagement_rate, 2);
}

// ER from followers when views/reach missing
{
  const result = computeEngagementRate({
    followers: 1_000_000,
    likes: 100,
    comments: 100,
    shares: 0,
    saves: 0,
  });
  assert.equal(result.engagement_rate_method, "followers");
  assert.equal(result.engagement_rate, 0.02);
}

// Manual override
{
  const result = computeEngagementRate({
    views: 1000,
    likes: 50,
    manualEngagementRate: 3.5,
  });
  assert.equal(result.engagement_rate_method, "manual");
  assert.equal(result.engagement_rate, 3.5);
}

// Followers → views auto-switch
{
  const before = computeEngagementRate({
    followers: 1_000_000,
    likes: 1000,
    comments: 0,
  });
  assert.equal(before.engagement_rate_method, "followers");

  const after = computeEngagementRate({
    views: 500_000,
    followers: 1_000_000,
    likes: 1000,
    comments: 0,
  });
  assert.equal(after.engagement_rate_method, "views");
  assert.equal(after.engagement_rate, 0.2);
}

// Missing followers and views
{
  const result = computeEngagementRate({
    likes: 10,
    comments: 5,
  });
  assert.equal(result.engagement_rate, null);
  assert.equal(result.engagement_rate_method, "unknown");
}

// Instagram photo without views — completed with comments
{
  assert.equal(isInstagramPhotoOrCarousel("instagram", "instagram_post"), true);
  assert.equal(
    metricsRefreshStatusForEngagement(
      { views: null, likes: null, comments: 108 },
      { platform: "instagram", publication_type: "instagram_post" }
    ),
    "completed"
  );
}

// Hidden likes
{
  assert.equal(isInstagramHiddenLikes("instagram", null, -1), true);
  assert.equal(
    isInstagramHiddenLikes("instagram", null, undefined, { hasOtherEngagement: true }),
    true
  );
  assert.equal(isInstagramHiddenLikes("instagram", null, undefined), false);
  assert.equal(computeEngagements({ likes: null, comments: 20 }), 20);
}

// Metrics source badges
assert.equal(metricsSourceBadge("manual", "views"), "mixed");
assert.equal(metricsSourceBadge("manual", "manual"), "manual");
assert.equal(metricsSourceBadge("apify", "views"), "automatic");

// Restore automatic: empty base + incoming auto metrics recalculates ER
{
  const restored = mergeCollectedMetrics(
    {},
    { views: 500_000, likes: 1000, comments: 0 },
    { followers: 1_000_000 }
  );
  assert.equal(restored.engagement_rate_method, "views");
  assert.equal(restored.engagement_rate, 0.2);
}

// Engagements sum with COALESCE
assert.equal(
  computeEngagements({ likes: null, comments: 10, shares: 5, saves: null }),
  15
);

// Full snapshot
{
  const snap = computeEngagementSnapshot({
    views: 10_000,
    likes: 200,
    comments: 50,
    shares: 10,
    saves: 5,
  });
  assert.equal(snap.engagements, 265);
  assert.equal(snap.engagement_rate_method, "views");
}

console.log("engagement-rate-engine tests passed");
