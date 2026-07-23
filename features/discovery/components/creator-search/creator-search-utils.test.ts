import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { audienceInterestList, categoriesLabel, sortCreators } from "./creator-search-utils";

function baseCreator(
  overrides: Partial<UnifiedCreatorResult> = {}
): UnifiedCreatorResult {
  return {
    unified_id: "inf:test",
    source_type: "imported",
    influencer_id: "test",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Test Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: 1_000_000, confidence: "estimated" },
      engagement_rate: { value: 1.2, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 70,
    source_confidence: 0.5,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    ...overrides,
  };
}

assert.deepEqual(audienceInterestList(baseCreator()), []);

assert.deepEqual(
  audienceInterestList(
    baseCreator({
      categories: [
        "Camera & Photography",
        "Clothes, Shoes, Handbags & Accessories",
      ],
    })
  ),
  ["Camera & Photography", "Clothes, Shoes, Handbags & Accessories"]
);

console.log(
  "features/discovery/components/creator-search/creator-search-utils.test.ts — audienceInterestList passed"
);

assert.equal(
  categoriesLabel(
    baseCreator({
      display_name: "Dr.dina muhamad| Nutritionist 💫 (@dr.dinamuhamad)",
      bio: "Nutritionist. ✨Birth doula. ✨Full time mum.",
      platforms: [
        {
          id: "pa1",
          platform: "instagram",
          handle: "dr.dinamuhamad",
          profile_url: null,
          follower_count: 100_000,
          engagement_rate: 2.5,
          audience_country: "EG",
          profile_bio: "Nutritionist. ✨Birth doula. ✨Full time mum.",
        },
      ],
    })
  ),
  "Health & Wellness, Parenting",
  "Discovery search categoriesLabel should infer from profile signals when stored tags are empty"
);

assert.equal(
  categoriesLabel(baseCreator({ display_name: "", bio: null, platforms: [] })),
  "—"
);

const alpha = baseCreator({
  unified_id: "inf:a",
  display_name: "Alpha",
  metrics: {
    followers: { value: 100, confidence: "estimated" },
    engagement_rate: { value: 2, confidence: "estimated" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: 50, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
  thinkway_score: 40,
  last_enriched_at: "2024-01-01T00:00:00.000Z",
});
const beta = baseCreator({
  unified_id: "inf:b",
  display_name: "Beta",
  metrics: {
    followers: { value: 200, confidence: "estimated" },
    engagement_rate: { value: 4, confidence: "estimated" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: 100, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
  thinkway_score: 80,
  last_enriched_at: "2025-01-01T00:00:00.000Z",
});

assert.deepEqual(
  sortCreators([alpha, beta], { field: "followers", direction: "asc" }).map((c) => c.unified_id),
  ["inf:a", "inf:b"]
);
assert.deepEqual(
  sortCreators([alpha, beta], { field: "followers", direction: "desc" }).map((c) => c.unified_id),
  ["inf:b", "inf:a"]
);
assert.deepEqual(
  sortCreators([alpha, beta], { field: "name", direction: "asc" }).map((c) => c.display_name),
  ["Alpha", "Beta"]
);
assert.deepEqual(
  sortCreators([alpha, beta], { field: "last_synced", direction: "desc" }).map(
    (c) => c.unified_id
  ),
  ["inf:b", "inf:a"]
);

const NOW = Date.parse("2026-07-18T12:00:00.000Z");
const DAY = 86_400_000;

const updatedToday = baseCreator({
  unified_id: "inf:today",
  display_name: "Updated Today",
  last_enriched_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
});
const updatedOneDay = baseCreator({
  unified_id: "inf:one-day",
  display_name: "Updated One Day",
  last_enriched_at: new Date(NOW - DAY).toISOString(),
});
const updatedTwoDays = baseCreator({
  unified_id: "inf:two-days",
  display_name: "Updated Two Days",
  last_enriched_at: new Date(NOW - 2 * DAY).toISOString(),
});
const neverUpdatedForRecency = baseCreator({
  unified_id: "inf:never-recency",
  display_name: "Never Updated",
  last_enriched_at: null,
  enrichment_status: "never",
});

assert.deepEqual(
  sortCreators(
    [neverUpdatedForRecency, updatedTwoDays, updatedOneDay, updatedToday],
    { field: "last_synced", direction: "desc" },
    NOW
  ).map((c) => c.unified_id),
  ["inf:today", "inf:one-day", "inf:two-days", "inf:never-recency"],
  "last_synced desc buckets by days since update with never last"
);

assert.deepEqual(
  sortCreators([neverUpdatedForRecency, updatedOneDay], {
    field: "last_synced",
    direction: "desc",
  }, NOW).map((c) => c.unified_id),
  ["inf:one-day", "inf:never-recency"],
  "never-updated stays last even when other sort fields would pin enriched rows"
);

const instagramCreator = baseCreator({
  unified_id: "inf:ig",
  display_name: "Instagram Creator",
  platforms: [{ id: "p1", platform: "instagram", handle: "ig", profile_url: null, follower_count: 100, engagement_rate: 2, audience_country: "EG" }],
  categories: ["beauty"],
  authenticity_score: 90,
  enrichment_source: "apify",
});
const tiktokCreator = baseCreator({
  unified_id: "inf:tt",
  display_name: "TikTok Creator",
  platforms: [{ id: "p2", platform: "tiktok", handle: "tt", profile_url: null, follower_count: 100, engagement_rate: 2, audience_country: "US" }],
  categories: ["fitness"],
  authenticity_score: 50,
});

assert.deepEqual(
  sortCreators([tiktokCreator, instagramCreator], { field: "platform", direction: "asc" }).map(
    (c) => c.unified_id
  ),
  ["inf:ig", "inf:tt"]
);
assert.deepEqual(
  sortCreators([tiktokCreator, instagramCreator], { field: "country", direction: "asc" }).map(
    (c) => c.unified_id
  ),
  ["inf:ig", "inf:tt"]
);
assert.deepEqual(
  sortCreators([tiktokCreator, instagramCreator], { field: "brand_safety", direction: "desc" }).map(
    (c) => c.unified_id
  ),
  ["inf:ig", "inf:tt"]
);
assert.deepEqual(
  sortCreators([tiktokCreator, instagramCreator], { field: "source", direction: "asc" }).map(
    (c) => c.unified_id
  ),
  ["inf:ig", "inf:tt"]
);

const enrichedSmall = baseCreator({
  unified_id: "inf:enriched",
  display_name: "Enriched Small",
  enrichment_status: "enriched",
  last_enriched_at: "2025-06-01T00:00:00.000Z",
  metrics: {
    followers: { value: 50, confidence: "verified" },
    engagement_rate: { value: 1, confidence: "verified" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: 10, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
});
const neverLarge = baseCreator({
  unified_id: "inf:never",
  display_name: "Never Large",
  enrichment_status: "never",
  last_enriched_at: null,
  metrics: {
    followers: { value: 9_000_000, confidence: "estimated" },
    engagement_rate: { value: 5, confidence: "estimated" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: 1000, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
});
const partialMid = baseCreator({
  unified_id: "inf:partial",
  display_name: "Partial Mid",
  enrichment_status: "partial",
  last_enriched_at: "2025-05-01T00:00:00.000Z",
  metrics: {
    followers: { value: 500, confidence: "verified" },
    engagement_rate: { value: 2, confidence: "verified" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: 50, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
});

assert.deepEqual(
  sortCreators([neverLarge, enrichedSmall, partialMid], {
    field: "followers",
    direction: "desc",
  }).map((c) => c.unified_id),
  ["inf:enriched", "inf:partial", "inf:never"],
  "enriched creators pin above others regardless of followers sort"
);

assert.deepEqual(
  sortCreators([neverLarge, enrichedSmall], { field: "name", direction: "asc" }).map(
    (c) => c.unified_id
  ),
  ["inf:enriched", "inf:never"],
  "enriched creators pin above others for name sort too"
);

const timestampOnly = baseCreator({
  unified_id: "inf:timestamp-only",
  display_name: "Timestamp Only",
  enrichment_status: "never",
  last_enriched_at: "2025-07-01T00:00:00.000Z",
  metrics: {
    followers: { value: 9_999_999, confidence: "estimated" },
    engagement_rate: { value: 9, confidence: "estimated" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: 9000, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
});
const enrichedLarge = baseCreator({
  unified_id: "inf:enriched-large",
  display_name: "Enriched Large",
  enrichment_status: "enriched",
  last_enriched_at: "2025-04-01T00:00:00.000Z",
  metrics: {
    followers: { value: 800, confidence: "verified" },
    engagement_rate: { value: 3, confidence: "verified" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: 80, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
});

assert.deepEqual(
  sortCreators([timestampOnly, neverLarge, enrichedSmall, partialMid], {
    field: "followers",
    direction: "desc",
  }).map((c) => c.unified_id),
  ["inf:enriched", "inf:timestamp-only", "inf:partial", "inf:never"],
  "timestamp-only rows sit with partial, never above true enriched"
);

assert.deepEqual(
  sortCreators([enrichedLarge, enrichedSmall], {
    field: "followers",
    direction: "desc",
  }).map((c) => c.unified_id),
  ["inf:enriched-large", "inf:enriched"],
  "user sort still applies within the enriched group"
);

const enrichedSinglePlatform = baseCreator({
  unified_id: "inf:enriched-single",
  display_name: "Enriched Single",
  enrichment_status: "enriched",
  country_code: "US",
  last_enriched_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
  platforms: [
    { id: "p1", platform: "tiktok", handle: "single", profile_url: null, follower_count: 100, engagement_rate: 2, audience_country: "US" },
  ],
});
const enrichedMultiPlatform = baseCreator({
  unified_id: "inf:enriched-multi",
  display_name: "Enriched Multi",
  enrichment_status: "enriched",
  country_code: "US",
  last_enriched_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
  platforms: [
    { id: "p1", platform: "tiktok", handle: "multi-tt", profile_url: null, follower_count: 100, engagement_rate: 2, audience_country: "US" },
    { id: "p2", platform: "instagram", handle: "multi-ig", profile_url: null, follower_count: 80, engagement_rate: 1.5, audience_country: "US" },
  ],
});
const egyptEnrichedMultiPlatform = baseCreator({
  unified_id: "inf:enriched-eg-multi",
  display_name: "Egypt Enriched Multi",
  enrichment_status: "enriched",
  country_code: "EG",
  estimated_country: "EG",
  last_enriched_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
  platforms: [
    { id: "p1", platform: "tiktok", handle: "eg-tt", profile_url: null, follower_count: 100, engagement_rate: 2, audience_country: "EG" },
    { id: "p2", platform: "instagram", handle: "eg-ig", profile_url: null, follower_count: 80, engagement_rate: 1.5, audience_country: "EG" },
  ],
});

assert.deepEqual(
  sortCreators([egyptEnrichedMultiPlatform, enrichedMultiPlatform, enrichedSinglePlatform], {
    field: "last_synced",
    direction: "desc",
  }, NOW).map((c) => c.unified_id),
  ["inf:enriched-eg-multi", "inf:enriched-multi", "inf:enriched-single"],
  "last_synced uses Egypt + multi + full pin tiers before recency tie-breaks"
);

console.log(
  "features/discovery/components/creator-search/creator-search-utils.test.ts — all tests passed"
);
