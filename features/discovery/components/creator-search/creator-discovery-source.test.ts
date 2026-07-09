import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { resolveCreatorDiscoverySource } from "./creator-discovery-source";

function baseCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
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
      followers: { value: 1000, confidence: "estimated" },
      engagement_rate: { value: 2, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 50,
    source_confidence: 0.5,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    ...overrides,
  };
}

test("resolveCreatorDiscoverySource prefers session Apify flag", () => {
  assert.equal(
    resolveCreatorDiscoverySource(baseCreator(), { sessionApify: true }),
    "apify"
  );
});

test("resolveCreatorDiscoverySource detects enrichment_source apify", () => {
  assert.equal(
    resolveCreatorDiscoverySource(baseCreator({ enrichment_source: "apify" })),
    "apify"
  );
});

test("resolveCreatorDiscoverySource detects platform sync_source apify", () => {
  assert.equal(
    resolveCreatorDiscoverySource(
      baseCreator({
        platforms: [
          {
            id: "pa-1",
            platform: "instagram",
            handle: "creator",
            profile_url: null,
            follower_count: 1000,
            engagement_rate: 2,
            audience_country: "EG",
            sync_source: "apify",
          },
        ],
      })
    ),
    "apify"
  );
});

test("resolveCreatorDiscoverySource defaults to imported", () => {
  assert.equal(resolveCreatorDiscoverySource(baseCreator()), "imported");
});
