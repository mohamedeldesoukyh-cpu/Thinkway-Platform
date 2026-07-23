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

console.log("resolve-browse-display-metrics.test.ts — all tests passed");
