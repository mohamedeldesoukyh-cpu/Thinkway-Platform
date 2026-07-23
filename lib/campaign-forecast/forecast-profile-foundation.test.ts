import assert from "node:assert/strict";

import {
  buildCreatorForecastProfile,
  computeCampaignForecast,
  computeCampaignForecastFromProfiles,
  profileToForecastCreatorInput,
  quotationItemsToForecastCreators,
  quotationItemsToForecastProfiles,
  searchCardsToForecastCreators,
  searchCardsToForecastProfiles,
  shortlistGroupsToForecastCreators,
  shortlistGroupsToForecastProfiles,
  type CreatorForecastProfile,
} from "./index";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

function mockUnifiedCreator(): import("@/lib/domains/creator/types").UnifiedCreatorResult {
  return {
    unified_id: "inf:test-creator",
    display_name: "Test Creator",
    country_code: "EG",
    country_codes: ["EG"],
    language_codes: ["ar"],
    categories: ["beauty"],
    browse_category_tags: [],
    ai_category: "beauty",
    ai_niche: "skincare",
    audience_interests: ["beauty"],
    last_enriched_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    dna_completeness: 0.82,
    is_platform_verified: true,
    metrics: {
      followers: { value: 120_000, confidence: "verified" },
      engagement_rate: { value: 4.2, confidence: "verified" },
      avg_views: { value: 45_000, confidence: "estimated" },
    },
    platforms: [
      {
        platform: "instagram",
        handle: "@testcreator",
        follower_count: 120_000,
        engagement_rate: 4.2,
        avg_views: 45_000,
        is_verified: true,
        recent_publications: [
          {
            views: 52_000,
            likes: 2100,
            comments: 84,
            posted_at: "2026-06-01T12:00:00Z",
            isVideo: true,
            caption: "Summer reel",
          },
        ],
      },
    ],
    recent_publications: [],
  } as import("@/lib/domains/creator/types").UnifiedCreatorResult;
}

function assertProfileShape(profile: CreatorForecastProfile) {
  assert.equal(profile.versioning.profileVersion, "forecast_profile_v1");
  assert.ok(profile.identity.creatorKey);
  assert.ok(profile.diagnostics);
  assert.ok(["ready", "benchmark_only", "limited_historical", "missing_performance"].includes(profile.readiness));
}

// --- Profile builder ---

{
  const profile = buildCreatorForecastProfile({
    unified: mockUnifiedCreator(),
    baselines: [
      {
        platform: "instagram",
        contentType: "instagram_reel",
        averageReach: 48_000,
        averageViews: 52_000,
        averageImpressions: null,
        averageEngagements: 2200,
        averageEngagementRate: 4.1,
        sampleCount: 12,
        confidence: 76,
        dataSource: "campaign_publications",
        lastCalculated: "2026-07-01T00:00:00Z",
        baselineVersion: "baseline_v1",
      },
    ],
    metricsHistory: {
      followers: [
        { capturedAt: "2026-05-01T00:00:00Z", value: 110_000 },
        { capturedAt: "2026-06-01T00:00:00Z", value: 120_000 },
      ],
      engagementRate: [{ capturedAt: "2026-06-01T00:00:00Z", value: 4.2 }],
      avgViews: [{ capturedAt: "2026-06-01T00:00:00Z", value: 45_000 }],
      postingFrequency: [{ capturedAt: "2026-06-01T00:00:00Z", value: 3.5 }],
      source: "influencer_metrics_history",
    },
    campaignPublications: [
      {
        platform: "instagram",
        publication_type: "instagram_reel",
        reach: 50_000,
        forecast_reach: 48_000,
        actual_reach: 51_000,
        impressions: 55_000,
        views: 53_000,
        engagements: 2300,
        engagement_rate: 4.3,
        metrics_refresh_status: "completed",
      },
    ],
  });

  assertProfileShape(profile);
  assert.equal(profile.readiness, "ready");
  assert.ok(profile.diagnostics.confidenceScore >= 70);
  assert.equal(profile.forecastBaselines.length >= 1, true);
  assert.equal(profile.campaignPerformance.totalPublications, 1);
  assert.equal(profile.publicationPerformance.totalSamples, 1);
  console.log("✓ high-confidence unified profile");
}

{
  const profile = buildCreatorForecastProfile({
    manualSnapshot: {
      creatorKey: "manual:low-data",
      displayName: "New Creator",
      handle: "@new",
      followers: 8000,
      primaryPlatform: "tiktok",
      engagementRate: 6.5,
    },
  });

  assertProfileShape(profile);
  assert.equal(profile.readiness, "benchmark_only");
  assert.ok(profile.diagnostics.confidenceScore < 70);
  assert.match(profile.diagnostics.reasons.join(" "), /Insufficient creator history/i);
  console.log("✓ low-confidence manual snapshot profile");
}

// --- Hydration parity across consumers ---

const rosterCreators = [
  {
    creatorKey: "c1",
    creator: "Creator One",
    handle: "@one",
    followersNumeric: 100_000,
    engagementRateNumeric: 3.5,
    platformLinks: [{ platform: "instagram" }],
  },
  {
    creatorKey: "c2",
    creator: "Creator Two",
    handle: "@two",
    followersNumeric: 80_000,
    engagementRateNumeric: 4.0,
    platformLinks: [{ platform: "instagram" }],
  },
];

const studioCards = [
  {
    id: "c1",
    displayName: "Creator One",
    handle: "@one",
    platform: "instagram",
    followers: 100_000,
    engagementRate: 3.5,
  },
  {
    id: "c2",
    displayName: "Creator Two",
    handle: "@two",
    platform: "instagram",
    followers: 80_000,
    engagementRate: 4.0,
  },
];

{
  const shortlistProfiles = shortlistGroupsToForecastProfiles(rosterCreators);
  const studioProfiles = searchCardsToForecastProfiles(studioCards, {
    defaultDeliverable: { contentType: "instagram_reel", platform: "instagram", quantity: 1 },
  });

  const shortlistHydrated = shortlistGroupsToForecastCreators(rosterCreators);
  const studioHydrated = searchCardsToForecastCreators(studioCards, {
    defaultDeliverable: { contentType: "instagram_reel", platform: "instagram", quantity: 1 },
  });

  assert.deepEqual(
    shortlistHydrated.map((c) => ({ followers: c.followers, er: c.engagementRate, platform: c.platform })),
    studioHydrated.map((c) => ({ followers: c.followers, er: c.engagementRate, platform: c.platform }))
  );

  const fromProfiles = computeCampaignForecastFromProfiles(shortlistProfiles, {
    campaignPlatform: "instagram",
  });
  const fromStudioProfiles = computeCampaignForecastFromProfiles(studioProfiles, {
    campaignPlatform: "instagram",
  });
  const legacy = computeCampaignForecast({ creators: shortlistHydrated, campaignPlatform: "instagram" });

  assert.equal(fromProfiles.estimatedReach, legacy.estimatedReach);
  assert.equal(fromStudioProfiles.estimatedReach, legacy.estimatedReach);
  assert.equal(fromProfiles.audienceSize, legacy.audienceSize);
  console.log("✓ hydration parity: shortlists, studio, legacy adapters");
}

{
  const quotationItem = {
    id: "item-1",
    influencer_id: null,
    profile_id: null,
    unified_id: null,
    source_shortlist_item_id: null,
    creator_name: "Creator One",
    handle: "@one",
    platform: "instagram",
    followers: 100_000,
    engagement_rate: 3.5,
    country_code: "EG",
    profile_image_url: null,
    profile_url: null,
    deliverables: [
      {
        platform: "instagram",
        type_lines: [{ type: "instagram_reel", quantity: 1 }],
      },
    ],
    option_number: 1,
    service_description: null,
    commercial_input_mode: "cost_gp_pct",
    cost: 1000,
    cost_currency: "EGP",
    revenue: 1333.33,
    gp_pct: 25,
    gp_value: 333.33,
    fx_rate_to_egp: 1,
    cost_egp: 1000,
    revenue_egp: 1333.33,
    gp_value_egp: 333.33,
    af_pct: 10,
    af_value: 133.33,
    af_value_egp: 133.33,
    sort_order: 0,
  } satisfies QuotationItemRow;

  const profiles = quotationItemsToForecastProfiles([quotationItem]);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0]?.forecastContext?.deliverables?.length, 1);

  const hydrated = profileToForecastCreatorInput(profiles[0]!);
  const legacy = quotationItemsToForecastCreators([quotationItem]);

  assert.equal(hydrated.followers, legacy[0]?.followers);
  assert.equal(hydrated.deliverables?.length, legacy[0]?.deliverables?.length);

  const forecastFromProfiles = computeCampaignForecastFromProfiles(profiles);
  const forecastLegacy = computeCampaignForecast({ creators: legacy });
  assert.equal(forecastFromProfiles.estimatedReach, forecastLegacy.estimatedReach);
  console.log("✓ hydration parity: quotations");
}

console.log("\nAll Phase 3 forecast profile foundation tests passed.");
