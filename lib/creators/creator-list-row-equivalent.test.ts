import assert from "node:assert/strict";
import { test } from "node:test";

import { creatorListRowEquivalent } from "./creator-list-row-equivalent";
import type { UnifiedCreatorResult } from "./types";

function baseCreator(
  overrides: Partial<UnifiedCreatorResult> = {}
): UnifiedCreatorResult {
  return {
    unified_id: "inf:cairoscene",
    source_type: "imported",
    influencer_id: "cairoscene",
    discovered_profile_id: null,
    document_number: null,
    display_name: "cairoscene",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: ["Media/News Company", "Travel", "Lifestyle"],
    browse_category_tags: ["Media/News Company", "Travel", "Lifestyle"],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: 877_200, confidence: "estimated" },
      engagement_rate: { value: 0.1, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: 20_800, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    audience_interests: [],
    authenticity_score: null,
    thinkway_score: 70,
    source_confidence: 0.5,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [
      {
        id: "pa-cairoscene",
        platform: "instagram",
        handle: "cairoscene",
        profile_url: null,
        follower_count: 877_200,
        engagement_rate: 0.1,
        audience_country: "EG",
        avg_views: 20_800,
      },
    ],
    ...overrides,
  };
}

test("category-only PR patches are not treated as equivalent", () => {
  const current = baseCreator();
  const next = baseCreator({
    categories: ["PR", "Media/News Company", "Travel", "Lifestyle"],
    browse_category_tags: ["PR", "Media/News Company", "Travel", "Lifestyle"],
  });
  assert.equal(creatorListRowEquivalent(current, next), false);
});

test("identical category snapshots stay equivalent", () => {
  const current = baseCreator();
  const next = baseCreator();
  assert.equal(creatorListRowEquivalent(current, next), true);
});
