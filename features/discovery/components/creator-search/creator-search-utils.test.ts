import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { audienceInterestList, sortCreators } from "./creator-search-utils";
import { DEFAULT_CREATOR_SEARCH_SORT } from "./creator-search-types";

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
  sortCreators([alpha, beta], { ...DEFAULT_CREATOR_SEARCH_SORT, field: "last_synced", direction: "desc" }).map(
    (c) => c.unified_id
  ),
  ["inf:b", "inf:a"]
);

console.log(
  "features/discovery/components/creator-search/creator-search-utils.test.ts — all tests passed"
);
