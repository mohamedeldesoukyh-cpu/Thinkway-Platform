import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import { buildCampaignSearchCriteria, rankBrowseCreatorsForCampaign } from "@/lib/discovery/rank-browse-for-campaign";

function sampleCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:test",
    source_type: "internal",
    influencer_id: "id-1",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Beauty Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: "Cairo",
    categories: ["beauty"],
    browse_category_tags: ["beauty"],
    audience_interests: ["skincare"],
    language_codes: ["ar"],
    profile_image_url: null,
    bio: "Egyptian beauty content",
    metrics: {
      followers: { value: 120_000, confidence: "verified" },
      engagement_rate: { value: 3.2, confidence: "verified" },
      avg_views: { value: 15_000, confidence: "estimated" },
      avg_likes: { value: 0, confidence: "estimated" },
      avg_comments: { value: 0, confidence: "estimated" },
      posting_frequency_per_week: { value: 0, confidence: "estimated" },
    },
    ai_category: "Beauty",
    ai_niche: "Skincare",
    authenticity_score: 82,
    thinkway_score: 75,
    source_confidence: 0.9,
    brand_fit_score: 70,
    is_platform_verified: false,
    platforms: [
      {
        platform: "instagram",
        handle: "beauty_eg",
        follower_count: 120_000,
        engagement_rate: 3.2,
        audience_country: "EG",
        profile_picture_url: null,
        is_verified: false,
        avg_views: 15_000,
      },
    ],
    ...overrides,
  } as UnifiedCreatorResult;
}

test("buildCampaignSearchCriteria adds objectives as soft keyword criteria", () => {
  const profile = {
    objectives: ["Drive skincare awareness in Egypt"],
  } as CampaignIntelligenceProfile;
  const mapped: DiscoveryMappedFilter[] = [
    {
      id: "1",
      key: "category",
      label: "Category",
      value: "beauty",
      weight: 100,
      confidence: 0.9,
    },
  ];

  const criteria = buildCampaignSearchCriteria(profile, mapped);
  assert.ok(criteria.some((c) => c.label === "Campaign objective"));
  assert.equal(criteria.filter((c) => c.meta?.discoveryKey === "category").length, 1);
});

test("rankBrowseCreatorsForCampaign orders creators by campaign relevance", () => {
  const weak = sampleCreator({
    unified_id: "inf:weak",
    country_code: "US",
    categories: [],
    bio: "Random",
    platforms: [
      {
        platform: "tiktok",
        handle: "random",
        follower_count: 5000,
        engagement_rate: 1,
        audience_country: "US",
        profile_picture_url: null,
        is_verified: false,
        avg_views: 500,
      } as UnifiedCreatorResult["platforms"][number],
    ],
  });
  const strong = sampleCreator({ unified_id: "inf:strong" });

  const profile = {} as CampaignIntelligenceProfile;
  const mapped: DiscoveryMappedFilter[] = [
    {
      id: "1",
      key: "audience_country",
      label: "Audience Country",
      value: "EG",
      weight: 100,
      confidence: 0.9,
    },
    {
      id: "2",
      key: "category",
      label: "Category",
      value: "beauty",
      weight: 100,
      confidence: 0.9,
    },
  ];

  const ranked = rankBrowseCreatorsForCampaign([weak, strong], profile, mapped);
  assert.equal(ranked[0]?.unified_id, "inf:strong");
  assert.equal(ranked[0]?.campaign_relevance_score, 100);
});
