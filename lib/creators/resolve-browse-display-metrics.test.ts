import assert from "node:assert/strict";

import { resolveCreatorBrowsePlatformStats } from "./resolve-browse-display-metrics";
import type { UnifiedCreatorResult } from "./types";

const creator = {
  unified_id: "inf:demo",
  influencer_id: "demo",
  discovered_profile_id: null,
  display_name: "Demo",
  profile_image_url: null,
  primaryAvatarUrl: null,
  default_metrics_platform_account_id: "ig-1",
  platforms: [
    {
      id: "ig-1",
      platform: "instagram",
      handle: "demo",
      profile_url: null,
      follower_count: null,
      engagement_rate: null,
      avg_likes: 1200,
      avg_comments: 80,
      audience_country: null,
      is_verified: false,
    },
  ],
  metrics: {
    followers: { value: 250_000, confidence: "verified" },
    engagement_rate: { value: 0.512, confidence: "verified" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: null, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
} as UnifiedCreatorResult;

const stats = resolveCreatorBrowsePlatformStats(creator);
assert.equal(stats[0]?.followers, 250_000, "uses creator.metrics followers when platform row is empty");
assert.equal(stats[0]?.engagement, 0.512, "uses creator.metrics engagement when platform row is empty");

const multi = {
  ...creator,
  unified_id: "inf:multi",
  platforms: [
    {
      id: "ig-1",
      platform: "instagram",
      handle: "demo",
      profile_url: null,
      follower_count: 397_600,
      engagement_rate: 3.06,
      avg_views: null,
      audience_country: null,
      is_verified: false,
    },
    {
      id: "tt-1",
      platform: "tiktok",
      handle: "demo",
      profile_url: null,
      follower_count: 454_300,
      engagement_rate: 12.83,
      avg_views: 1_200_000,
      audience_country: null,
      is_verified: false,
    },
    {
      id: "fb-1",
      platform: "facebook",
      handle: "demo",
      profile_url: null,
      follower_count: null,
      engagement_rate: null,
      avg_views: null,
      audience_country: null,
      is_verified: false,
      enrichment_status: "never",
    },
  ],
} as UnifiedCreatorResult;

const multiStats = resolveCreatorBrowsePlatformStats(multi);
assert.equal(multiStats.length, 3, "one row per connected platform including dead Facebook");
assert.equal(multiStats[0]?.avgViews, null, "null IG avg-views stays null (renders —), never 0");
assert.equal(multiStats[2]?.platform, "facebook");
assert.equal(multiStats[2]?.followers, null);
assert.equal(multiStats[2]?.engagement, null);
assert.equal(multiStats[2]?.avgViews, null);
assert.equal(multiStats[2]?.metricsHint ?? null, null, "dead FB shows — — —, not a collapsed hint");

console.log("resolve-browse-display-metrics.test.ts — all tests passed");
