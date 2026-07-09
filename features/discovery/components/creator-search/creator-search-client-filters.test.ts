import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { applyCreatorSearchClientFilters } from "./creator-search-client-filters";
import type { CreatorSearchFilters } from "./creator-search-types";
import { DEFAULT_CREATOR_SEARCH_FILTERS } from "./creator-search-types";

function makeCreator(
  partial: Partial<UnifiedCreatorResult> & Pick<UnifiedCreatorResult, "unified_id">
): UnifiedCreatorResult {
  return {
    source_type: "imported",
    influencer_id: partial.unified_id.replace("inf:", ""),
    discovered_profile_id: null,
    document_number: "TW-TEST-1",
    display_name: "Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    metrics: {
      followers: { value: 1000, confidence: "verified" },
      engagement_rate: { value: 1.2, confidence: "verified" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 50,
    source_confidence: 80,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    bio: null,
    ...partial,
  };
}

test("applyCreatorSearchClientFilters enforces category chips via interest tags", () => {
  const filters: CreatorSearchFilters = {
    ...DEFAULT_CREATOR_SEARCH_FILTERS,
    categories: ["Beauty"],
  };

  const creators = [
    makeCreator({
      unified_id: "inf:1",
      browse_category_tags: [],
      audience_interests: ["Beauty"],
    }),
    makeCreator({
      unified_id: "inf:2",
      browse_category_tags: [],
      audience_interests: ["Fashion"],
    }),
  ];

  const filtered = applyCreatorSearchClientFilters(creators, filters);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.unified_id, "inf:1");
});

test("applyCreatorSearchClientFilters enforces category chips", () => {
  const filters: CreatorSearchFilters = {
    ...DEFAULT_CREATOR_SEARCH_FILTERS,
    categories: ["Food Pro"],
  };

  const creators = [
    makeCreator({
      unified_id: "inf:1",
      browse_category_tags: ["Food Pro"],
      categories: ["Food Pro", "Beauty"],
    }),
    makeCreator({
      unified_id: "inf:2",
      browse_category_tags: ["Beauty"],
      categories: ["Beauty", "Fashion"],
    }),
  ];

  const filtered = applyCreatorSearchClientFilters(creators, filters);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.unified_id, "inf:1");
});
