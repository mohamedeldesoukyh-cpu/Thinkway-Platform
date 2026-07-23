import assert from "node:assert/strict";

import { metricWithConfidence } from "@/lib/creators/confidence";
import { discoveryCreatorCategoriesLabel } from "@/lib/creators/creator-display-categories";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { slimRecentPublicationsForBrowse } from "@/lib/creators/unified-browse";

import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";

/** Fields DiscoveryCreatorExactRow reads from UnifiedCreatorResult. */
export const DISCOVERY_SEARCH_ROW_PARITY_FIELDS = [
  "profile_image_url",
  "bio",
  "country_code",
  "estimated_country",
  "categories",
  "audience_interests",
  "authenticity_score",
  "thinkway_score",
  "enrichment_status",
  "last_enriched_at",
  "enrichment_source",
  "recent_publications",
  "platforms",
  "metrics",
  "notes",
] as const satisfies readonly (keyof UnifiedCreatorResult)[];

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
    profile_image_url: "https://cdn.example/avatar.jpg",
    primaryAvatarUrl: "https://cdn.example/avatar.jpg",
    primaryAvatarSource: "imported",
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
      avg_views: metricWithConfidence(120_000, "verified"),
      posting_frequency_per_week: metricWithConfidence(null, "estimated"),
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: 82,
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
        avg_views: 120_000,
        audience_country: "EG",
        is_verified: true,
        profile_picture_url: "https://cdn.example/avatar.jpg",
        profile_bio: "Chef content",
        sync_source: "imported",
      },
    ],
    notes: null,
    suggested_currency: "EGP",
    enrichment_status: "enriched",
    last_enriched_at: "2026-07-01T00:00:00.000Z",
    enrichment_source: "imported",
    recent_publications: [
      {
        url: "https://instagram.com/p/1",
        thumbnail: "https://cdn.example/thumb1.jpg",
        likes: null,
        comments: null,
        views: null,
        posted_at: null,
        caption: null,
        isVideo: false,
      },
    ],
    search_rank: null,
    ...overrides,
  };
}

const sample = creator();
for (const field of DISCOVERY_SEARCH_ROW_PARITY_FIELDS) {
  assert.ok(field in sample, `parity fixture must include ${field}`);
}

const vm = buildDiscoveryCreatorViewModel(sample);
assert.equal(vm.displayName, sample.display_name);
assert.equal(vm.handleLabel, "@wassoufspecial2");
assert.equal(
  vm.categoriesLabel,
  discoveryCreatorCategoriesLabel(sample),
  "exact row category column must match shared discoveryCreatorCategoriesLabel"
);
assert.ok(
  vm.categories.length > 0,
  "exact row category chips must use resolveDiscoveryCreatorDisplayCategories"
);

const slimmed = slimRecentPublicationsForBrowse([sample])[0]!;
assert.equal(slimmed.recent_publications?.length, 1);
assert.equal(slimmed.recent_publications?.[0]?.thumbnail, "https://cdn.example/thumb1.jpg");
assert.ok(sample.bio);
assert.ok(sample.metrics.avg_views.value);
assert.ok(sample.authenticity_score != null);

console.log(
  "features/discovery/components/creator-search/creator-search-row-parity.test.ts — all tests passed"
);
