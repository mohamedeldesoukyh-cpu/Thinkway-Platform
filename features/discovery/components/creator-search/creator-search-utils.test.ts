import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { audienceInterestList } from "./creator-search-utils";

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
  "features/discovery/components/creator-search/creator-search-utils.test.ts — all tests passed"
);
