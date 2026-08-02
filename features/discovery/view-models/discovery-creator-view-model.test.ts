import assert from "node:assert/strict";

import { metricWithConfidence } from "@/lib/creators/confidence";
import { discoveryCreatorCategoriesLabel } from "@/lib/creators/creator-display-categories";
import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { resolveCreatorBrowsePlatformStats } from "@/lib/creators/resolve-browse-display-metrics";
import { creatorRecentPublicationDisplayUrl } from "@/lib/creators/recent-publication-thumb";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { slimRecentPublicationsForBrowse } from "@/lib/creators/unified-browse";
import { resolveCreatorDiscoverySource } from "@/features/discovery/components/creator-search/creator-discovery-source";
import {
  audienceCountryLabel,
  brandSafetyMeta,
  formatEngagementRate,
  normalizeCountryCode,
} from "@/features/discovery/components/creator-search/creator-search-utils";
import { resolveCreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";

import {
  buildDiscoveryCreatorViewModel,
  resolveDiscoveryCreatorHandleLabel,
  resolveDiscoveryCreatorMetaLabel,
} from "./discovery-creator-view-model";

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
    bio: "Egyptian chef sharing recipes and kitchen tips daily with long-form content for families across the region",
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
    eci_investment_score: 80,
    eci_investment_recommendation: "Recommended",
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
const platform = sample.platforms[0]!;
const vm = buildDiscoveryCreatorViewModel(sample);

assert.equal(vm.displayName, sample.display_name);
assert.equal(vm.handleLabel, resolveDiscoveryCreatorHandleLabel(platform));
assert.equal(vm.handleLabel, "@wassoufspecial2");
assert.equal(vm.avatarUrl, creatorProfileSourceFromUnified(sample).avatarUrl ?? null);
assert.equal(vm.categoriesLabel, discoveryCreatorCategoriesLabel(sample));
assert.equal(vm.metaLabel, resolveDiscoveryCreatorMetaLabel(sample, platform));
assert.notEqual(vm.metaLabel, "No categories", "inferred categories must populate meta label");
assert.equal(vm.countryLabel, audienceCountryLabel(sample));
assert.equal(vm.countryFlagCode, "EG");
assert.equal(vm.brandSafety.label, brandSafetyMeta(sample.authenticity_score).label);
assert.equal(vm.enrichmentStatus, resolveCreatorEnrichmentStatus(sample.enrichment_status));
assert.equal(
  vm.discoverySource,
  resolveCreatorDiscoverySource(sample, { sessionApify: false })
);
assert.equal(vm.thinkwayStarLabel, "8.0");
assert.ok(vm.bioTruncated && vm.bioTruncated.endsWith("…"), "long bio should truncate");
assert.equal(vm.feedPublications.length, 1);
assert.equal(
  creatorRecentPublicationDisplayUrl(vm.feedPublications[0]!),
  "https://cdn.example/thumb1.jpg"
);
assert.equal(vm.platformStats[0]?.followers, 500_000);
assert.equal(
  formatEngagementRate(vm.platformStats[0]?.engagement),
  formatEngagementRate(0.03)
);

const slimmed = slimRecentPublicationsForBrowse([sample])[0]!;
const slimVm = buildDiscoveryCreatorViewModel(slimmed);
assert.equal(slimVm.feedPublications.length, 1);
assert.deepEqual(
  slimVm.platformStats.map((row) => row.followers),
  resolveCreatorBrowsePlatformStats({ ...slimmed, platforms: slimVm.displayPlatforms }).map(
    (row) => row.followers
  )
);

assert.equal(
  buildDiscoveryCreatorViewModel(creator({ categories: ["Beauty"], audience_interests: [] }))
    .metaLabel,
  "Beauty"
);

assert.equal(
  buildDiscoveryCreatorViewModel(creator({ platforms: [] })).handleLabel,
  null,
  "name column must omit @handle when no platform handle exists"
);

console.log("features/discovery/view-models/discovery-creator-view-model.test.ts — all tests passed");
