import assert from "node:assert/strict";

import {
  BROWSE_PIN_SORT_POOL_MAX,
  browsePinTier,
  browseSortedPoolHasMore,
  compareBrowseDefaultOrder,
  compareBrowsePinTier,
  paginateBrowseCreators,
  resolveBrowseSortPoolSize,
} from "@/lib/creators/browse-pin-tier";

const NOW = Date.parse("2026-07-18T12:00:00.000Z");
const DAY = 86_400_000;

const platform = (name: string, id: string, country = "US") => ({
  id,
  platform: name,
  handle: id,
  profile_url: null,
  follower_count: 100,
  engagement_rate: 2,
  audience_country: country,
});

const enrichedMultiRecent = {
  country_code: "US",
  estimated_country: "US",
  enrichment_status: "enriched" as const,
  last_enriched_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
  updated_at: null,
  platforms: [platform("tiktok", "p1"), platform("instagram", "p2")],
  thinkway_score: 10,
  unified_id: "inf:us-multi",
};

const egyptEnrichedMultiRecent = {
  ...enrichedMultiRecent,
  country_code: "EG",
  estimated_country: "EG",
  platforms: [platform("tiktok", "p1", "EG"), platform("instagram", "p2", "EG")],
  unified_id: "inf:eg-multi",
};

const enrichedSingleRecent = {
  ...enrichedMultiRecent,
  platforms: [platform("tiktok", "p1")],
  unified_id: "inf:us-single",
};

const enrichedSingleStale = {
  ...enrichedSingleRecent,
  last_enriched_at: new Date(NOW - 30 * DAY).toISOString(),
  unified_id: "inf:us-single-stale",
};

const enrichedMultiStale = {
  ...enrichedMultiRecent,
  last_enriched_at: new Date(NOW - 30 * DAY).toISOString(),
  unified_id: "inf:us-multi-stale",
};

const partialRecent = {
  country_code: "EG",
  estimated_country: "EG",
  enrichment_status: "partial" as const,
  last_enriched_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
  updated_at: null,
  platforms: [platform("tiktok", "p1", "EG"), platform("instagram", "p2", "EG")],
  thinkway_score: 99,
  unified_id: "inf:eg-partial",
};

const neverUpdated = {
  country_code: "EG",
  estimated_country: "EG",
  enrichment_status: "never" as const,
  last_enriched_at: null,
  updated_at: null,
  platforms: [platform("tiktok", "p1", "EG")],
  thinkway_score: 99,
  unified_id: "inf:never",
};

assert.equal(browsePinTier(egyptEnrichedMultiRecent), 0);
assert.equal(browsePinTier(enrichedMultiRecent), 1);
assert.equal(browsePinTier(enrichedSingleRecent), 2);
assert.equal(
  browsePinTier({
    ...enrichedSingleStale,
    last_enriched_at: null,
    updated_at: null,
    enrichment_status: "enriched",
  }),
  3,
  "full data without update timestamp is tier 3"
);
assert.equal(browsePinTier(partialRecent), 4, "updated without full data is tier 4");
assert.equal(browsePinTier(neverUpdated), 5);

assert.ok(
  compareBrowsePinTier(egyptEnrichedMultiRecent, enrichedMultiRecent) < 0,
  "Egypt full multi recent ranks above non-Egypt full multi recent"
);

assert.ok(
  compareBrowseDefaultOrder(enrichedMultiStale, enrichedSingleRecent, "desc", NOW) < 0,
  "tier 1 beats tier 2 even when tier 1 is older"
);

assert.ok(
  compareBrowseDefaultOrder(enrichedMultiRecent, enrichedSingleRecent, "desc", NOW) < 0,
  "within tier 1, multi ranks above single via tier membership"
);

assert.deepEqual(
  [
    neverUpdated,
    partialRecent,
    enrichedSingleStale,
    enrichedSingleRecent,
    enrichedMultiRecent,
    egyptEnrichedMultiRecent,
  ]
    .sort((a, b) => compareBrowseDefaultOrder(a, b, "desc", NOW))
    .map((creator) => creator.unified_id),
  [
    "inf:eg-multi",
    "inf:us-multi",
    "inf:us-single",
    "inf:us-single-stale",
    "inf:eg-partial",
    "inf:never",
  ],
  "full browse default order respects pin tiers"
);

const pageSize = 50;
const pool = Array.from({ length: BROWSE_PIN_SORT_POOL_MAX }, (_, i) => i);
assert.equal(resolveBrowseSortPoolSize(6, pageSize), BROWSE_PIN_SORT_POOL_MAX);
assert.deepEqual(paginateBrowseCreators(pool, 6, pageSize), []);
assert.equal(
  browseSortedPoolHasMore(5 * pageSize, 0, pool.length),
  false,
  "empty page beyond capped pool must stop pagination"
);
assert.equal(
  browseSortedPoolHasMore(4 * pageSize, pageSize, pool.length),
  false,
  "final full page of capped pool has no next page"
);
assert.equal(
  browseSortedPoolHasMore(3 * pageSize, pageSize, pool.length),
  true,
  "earlier pages within capped pool still have more"
);

console.log("lib/creators/browse-pin-tier.test.ts — all tests passed");
