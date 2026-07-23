import assert from "node:assert/strict";

import { metricWithConfidence } from "@/lib/creators/confidence";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";

function creator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:test",
    source_type: "internal",
    influencer_id: "test",
    discovered_profile_id: null,
    document_number: "TW-2026-0001",
    display_name: "Wassouf | Chef",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    browse_category_tags: [],
    audience_interests: ["Food & Cooking"],
    audience_demographics: null,
    language_codes: [],
    profile_image_url: null,
    primaryAvatarUrl: null,
    primaryAvatarSource: "placeholder",
    default_metrics_platform_account_id: "pa-1",
    bio: "Egyptian chef sharing recipes",
    hashtags: ["#food"],
    mentions: [],
    contact_email: null,
    contact_phone: null,
    contact_links: null,
    role: null,
    metrics: {
      followers: metricWithConfidence(500_000, "verified"),
      engagement_rate: metricWithConfidence(0.03, "verified"),
      avg_likes: metricWithConfidence(1000, "verified"),
      avg_comments: metricWithConfidence(40, "verified"),
      avg_views: metricWithConfidence(null, "estimated"),
      posting_frequency_per_week: metricWithConfidence(null, "estimated"),
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 80,
    source_confidence: 0.9,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [
      {
        id: "pa-1",
        platform: "instagram",
        handle: "wassoufspecial2",
        profile_url: "https://instagram.com/wassoufspecial2",
        follower_count: 500_000,
        engagement_rate: 0.03,
        audience_country: "EG",
        is_verified: true,
        profile_picture_url: null,
        profile_bio: "Chef content",
      },
    ],
    notes: null,
    suggested_currency: "EGP",
    enrichment_status: "enriched",
    last_enriched_at: null,
    enrichment_source: null,
    recent_publications: [],
    search_rank: null,
    ...overrides,
  };
}

const vm = buildDiscoveryCreatorViewModel(creator());

assert.equal(vm.displayName, "Wassouf | Chef");
assert.equal(vm.handleLabel, "@wassoufspecial2");

assert.ok(
  vm.categories.length > 0,
  "inferred categories must render when stored categories[] is empty"
);

assert.match(
  vm.categories.join(" "),
  /food|cooking/i,
  "exact row category column should show resolved category labels, not only stored categories.length"
);

assert.deepEqual(
  buildDiscoveryCreatorViewModel(creator({ categories: ["Beauty"], audience_interests: [] }))
    .categories,
  ["Beauty"]
);

assert.equal(
  buildDiscoveryCreatorViewModel(creator({ platforms: [] })).handleLabel,
  null,
  "exact row name column must not show a placeholder handle"
);

console.log("features/discovery/components/creator-search/creator-search-exact-row.test.ts — all tests passed");
