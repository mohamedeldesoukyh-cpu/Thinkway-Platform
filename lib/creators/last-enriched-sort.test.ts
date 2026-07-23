import assert from "node:assert/strict";

import {
  compareByLastEnrichedRecency,
  compareBrowseRecencyDesc,
  daysSinceLastEnriched,
  resolveCreatorBrowseRecencyIso,
} from "@/lib/creators/last-enriched-sort";

const NOW = Date.parse("2026-07-18T12:00:00.000Z");
const DAY = 86_400_000;

assert.equal(daysSinceLastEnriched(null, NOW), null);
assert.equal(daysSinceLastEnriched("not-a-date", NOW), null);
assert.equal(daysSinceLastEnriched(new Date(NOW - DAY).toISOString(), NOW), 1);
assert.equal(daysSinceLastEnriched(new Date(NOW - 2 * DAY).toISOString(), NOW), 2);
assert.equal(daysSinceLastEnriched(new Date(NOW - 12 * 60 * 60 * 1000).toISOString(), NOW), 0);

const oneDayAgo = { last_enriched_at: new Date(NOW - DAY).toISOString() };
const twoDaysAgo = { last_enriched_at: new Date(NOW - 2 * DAY).toISOString() };
const neverUpdated = { last_enriched_at: null };

assert.equal(
  compareByLastEnrichedRecency(oneDayAgo, twoDaysAgo, "desc", NOW),
  -1,
  "1 day ago before 2 days ago when desc"
);
assert.equal(
  compareByLastEnrichedRecency(twoDaysAgo, oneDayAgo, "asc", NOW),
  -1,
  "2 days ago before 1 day ago when asc"
);
assert.equal(
  compareByLastEnrichedRecency(oneDayAgo, neverUpdated, "desc", NOW),
  -1,
  "dated creators before never-updated"
);
assert.equal(
  compareByLastEnrichedRecency(neverUpdated, oneDayAgo, "desc", NOW),
  1,
  "never-updated after dated creators"
);

const recentlyAdded = {
  last_enriched_at: null,
  updated_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
};
assert.ok(
  compareByLastEnrichedRecency(recentlyAdded, twoDaysAgo, "desc", NOW) < 0,
  "updated_at fallback ranks newly added creators ahead of older enrichments"
);
assert.equal(
  resolveCreatorBrowseRecencyIso(recentlyAdded),
  recentlyAdded.updated_at
);

assert.ok(
  compareBrowseRecencyDesc(
    { ...recentlyAdded, thinkway_score: 5, unified_id: "inf:new" },
    { ...twoDaysAgo, thinkway_score: 99, unified_id: "inf:old" },
    NOW
  ) < 0,
  "browse recency sort prefers updated_at fallback over thinkway score"
);

const sameDaySingle = {
  last_enriched_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
  enrichment_status: "enriched" as const,
  country_code: "US",
  estimated_country: "US",
  platforms: [{ id: "p1", platform: "tiktok", handle: "a", profile_url: null, follower_count: 1, engagement_rate: 1, audience_country: "US" }],
  thinkway_score: 10,
  unified_id: "inf:single",
};
const sameDayMulti = {
  last_enriched_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
  enrichment_status: "enriched" as const,
  country_code: "US",
  estimated_country: "US",
  platforms: [
    { id: "p1", platform: "tiktok", handle: "b", profile_url: null, follower_count: 1, engagement_rate: 1, audience_country: "US" },
    { id: "p2", platform: "instagram", handle: "c", profile_url: null, follower_count: 1, engagement_rate: 1, audience_country: "US" },
  ],
  thinkway_score: 5,
  unified_id: "inf:multi",
};

assert.ok(
  compareBrowseRecencyDesc(sameDayMulti, sameDaySingle, NOW) < 0,
  "same recency prefers multi-platform enriched creators"
);

console.log("lib/creators/last-enriched-sort.test.ts — all tests passed");
