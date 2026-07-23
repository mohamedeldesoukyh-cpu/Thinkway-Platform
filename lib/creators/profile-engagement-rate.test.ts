import assert from "node:assert/strict";

import {
  computeProfileEngagementRate,
  resolvePlatformEngagementRate,
  resolvePlatformEngagementRates,
} from "./profile-engagement-rate";

assert.equal(
  computeProfileEngagementRate({ avgLikes: 100, avgComments: 20, followers: 10_000 }),
  1.2
);
assert.equal(
  computeProfileEngagementRate({ avgLikes: null, avgComments: 50, followers: 5_000 }),
  1
);
assert.equal(
  computeProfileEngagementRate({ avgLikes: 10, avgComments: 5, followers: 0 }),
  null
);

const igDerived = resolvePlatformEngagementRate({
  engagement_rate: 3.2,
  avg_likes: 400,
  avg_comments: 40,
  follower_count: 20_000,
});
assert.equal(igDerived, 2.2, "prefer derived ER from platform avgs over stored");

// INVARIANT: duplicated imported ER across platforms is still displayed, never nulled.
const shared = resolvePlatformEngagementRates([
  {
    id: "ig",
    platform: "instagram",
    engagement_rate: 3.2,
    avg_likes: null,
    avg_comments: null,
    follower_count: 100_000,
  },
  {
    id: "tt",
    platform: "tiktok",
    engagement_rate: 3.2,
    avg_likes: null,
    avg_comments: null,
    follower_count: 50_000,
  },
]);
assert.equal(shared[0]?.engagement_rate, 3.2, "keep shared imported ER on first platform");
assert.equal(
  shared[1]?.engagement_rate,
  3.2,
  "stored ER is never suppressed to null, even when duplicated across platforms"
);

const withAvgs = resolvePlatformEngagementRates([
  {
    id: "ig",
    engagement_rate: 3.2,
    avg_likes: 1_000,
    avg_comments: 100,
    follower_count: 50_000,
  },
  {
    id: "tt",
    engagement_rate: 3.2,
    avg_likes: 2_000,
    avg_comments: 200,
    follower_count: 40_000,
  },
]);
assert.equal(withAvgs[0]?.engagement_rate, 2.2);
assert.equal(withAvgs[1]?.engagement_rate, 5.5);

const fromPubs = resolvePlatformEngagementRate({
  engagement_rate: null,
  avg_likes: null,
  avg_comments: null,
  follower_count: 10_000,
  recent_publications: [
    { likes: 200, comments: 20 },
    { likes: 100, comments: 10 },
  ],
});
assert.equal(fromPubs, 1.65);

// INVARIANT: stored ER survives when no local signals can derive anything.
const storedOnly = resolvePlatformEngagementRate({
  engagement_rate: 4.7,
  avg_likes: null,
  avg_comments: null,
  follower_count: null,
});
assert.equal(storedOnly, 4.7, "stored ER kept when no better signal exists");

console.log("lib/creators/profile-engagement-rate.test.ts — all tests passed");
