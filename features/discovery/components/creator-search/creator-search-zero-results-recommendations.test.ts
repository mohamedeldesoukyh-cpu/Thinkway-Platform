import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { describeMatchedCampaignCriteria } from "@/lib/discovery/campaign-relevance-scoring";

import { buildCreatorSearchRecommendations } from "./creator-search-zero-results-recommendations";
import {
  creatorSearchFiltersToCriteria,
  DEFAULT_CREATOR_SEARCH_FILTERS,
} from "./creator-search-types";

function sampleCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:1",
    source_type: "internal",
    influencer_id: "id-1",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Beauty Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: ["Beauty"],
    browse_category_tags: ["Beauty"],
    language_codes: ["en"],
    profile_image_url: null,
    bio: "Beauty content",
    metrics: {
      followers: { value: 50_000, confidence: "verified" },
      engagement_rate: { value: 2.5, confidence: "verified" },
      avg_views: { value: null, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: "Beauty",
    ai_niche: "Skincare",
    authenticity_score: null,
    thinkway_score: 60,
    source_confidence: 0.8,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [{ id: "pa-1", platform: "instagram", handle: "beauty", profile_url: null, follower_count: 50_000, engagement_rate: 2.5, audience_country: "EG", recent_publications: [] }],
    ...overrides,
  };
}

test("creatorSearchFiltersToCriteria maps multi-select filters to weighted criteria", () => {
  const criteria = creatorSearchFiltersToCriteria({
    ...DEFAULT_CREATOR_SEARCH_FILTERS,
    categories: ["Beauty"],
    platforms: ["instagram"],
    languages: ["en", "ar"],
  });

  assert.equal(criteria.length, 4);
  assert.ok(criteria.some((c) => c.meta?.discoveryKey === "category"));
  assert.ok(criteria.some((c) => c.meta?.discoveryKey === "platform"));
  assert.equal(criteria.filter((c) => c.kind === "language").length, 2);
});

test("buildCreatorSearchRecommendations ranks by campaign relevance and exposes matches", () => {
  const filters = {
    ...DEFAULT_CREATOR_SEARCH_FILTERS,
    categories: ["Beauty"],
    countries: ["EG"],
    platforms: ["instagram"],
  };

  const recommendations = buildCreatorSearchRecommendations(
    [
      sampleCreator({ unified_id: "inf:match", display_name: "Match" }),
      sampleCreator({
        unified_id: "inf:other",
        display_name: "Other",
        categories: ["Gaming"],
        browse_category_tags: ["Gaming"],
        country_code: "US",
        estimated_country: "US",
        platforms: [{ id: "pa-2", platform: "tiktok", handle: "gamer", profile_url: null, follower_count: 10_000, engagement_rate: 1, audience_country: "US", recent_publications: [] }],
      }),
    ],
    filters,
    { limit: 5 }
  );

  assert.ok(recommendations.length >= 1);
  assert.equal(recommendations[0]?.creator.unified_id, "inf:match");
  assert.ok((recommendations[0]?.relevanceScore ?? 0) > 0);
  assert.ok(recommendations[0]?.matchedAttributes.includes("Same category"));
});

test("describeMatchedCampaignCriteria returns human labels for matched filters", () => {
  const criteria = creatorSearchFiltersToCriteria({
    ...DEFAULT_CREATOR_SEARCH_FILTERS,
    categories: ["Beauty"],
    audienceCountries: ["EG"],
  });

  const labels = describeMatchedCampaignCriteria(sampleCreator(), criteria);
  assert.ok(labels.includes("Same category"));
  assert.ok(labels.includes("Same audience country"));
});

console.log("creator-search-zero-results-recommendations.test.ts — passed");
