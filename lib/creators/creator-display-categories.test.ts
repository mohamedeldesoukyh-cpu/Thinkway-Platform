import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  discoveryCreatorCategoriesLabel,
  resolveDiscoveryCreatorDisplayCategories,
} from "./creator-display-categories";

function drDinaCreator(
  overrides: Partial<UnifiedCreatorResult> = {}
): UnifiedCreatorResult {
  return {
    unified_id: "inf:dr-dina",
    source_type: "imported",
    influencer_id: "dr-dina",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Dr.dina muhamad| Nutritionist 💫 (@dr.dinamuhamad)",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    browse_category_tags: [],
    language_codes: [],
    profile_image_url: null,
    bio: "Nutritionist. ✨Birth doula. ✨Full time mum.",
    metrics: {
      followers: { value: 100_000, confidence: "estimated" },
      engagement_rate: { value: 2.5, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
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
        id: "pa-dr-dina",
        platform: "instagram",
        handle: "dr.dinamuhamad",
        profile_url: null,
        follower_count: 100_000,
        engagement_rate: 2.5,
        audience_country: "EG",
        profile_bio: "Nutritionist. ✨Birth doula. ✨Full time mum.",
      },
    ],
    ...overrides,
  };
}

const drDinaCategories = resolveDiscoveryCreatorDisplayCategories(drDinaCreator());
assert.deepEqual(
  drDinaCategories.sort(),
  ["Health & Wellness", "Parenting"],
  "Dr. Dina should infer Health & Wellness and Parenting from bio and pipe display name"
);

assert.equal(
  discoveryCreatorCategoriesLabel(drDinaCreator()),
  "Health & Wellness, Parenting",
  "Discovery label should join inferred categories"
);

assert.deepEqual(
  resolveDiscoveryCreatorDisplayCategories(
    drDinaCreator({
      categories: ["Beauty"],
      browse_category_tags: ["Beauty"],
    })
  ),
  ["Beauty"],
  "Stored categories that map to a main category should win over inference"
);

assert.deepEqual(
  resolveDiscoveryCreatorDisplayCategories(
    drDinaCreator({
      categories: [],
      browse_category_tags: [],
      bio: null,
      display_name: "",
      platforms: [],
    })
  ),
  [],
  "Creators without category signals should stay empty"
);

console.log("lib/creators/creator-display-categories.test.ts — all tests passed");
