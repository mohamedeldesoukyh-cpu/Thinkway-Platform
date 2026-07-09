import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";
import {
  isCampaignRelevanceSearchActive,
  rankCreatorsByCampaignRelevance,
  scoreCreatorCampaignRelevance,
} from "@/lib/discovery/campaign-relevance-scoring";

function sampleCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:test",
    source_type: "influencer",
    influencer_id: "id-1",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Beauty Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: "Cairo",
    categories: ["beauty", "skincare"],
    browse_category_tags: ["beauty"],
    audience_interests: ["makeup", "skincare"],
    language_codes: ["ar"],
    profile_image_url: null,
    bio: "Egyptian beauty and skincare content",
    metrics: {
      followers: { value: 120_000, confidence: "high" },
      engagement_rate: { value: 3.2, confidence: "high" },
      avg_views: { value: 15_000, confidence: "medium" },
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
        platform_account_id: "pa-1",
        url: null,
        is_verified: false,
        avg_views: 15_000,
      },
    ],
    ...overrides,
  };
}

function criterion(
  partial: Partial<CampaignSearchCriterion> & Pick<CampaignSearchCriterion, "id" | "label" | "value">
): CampaignSearchCriterion {
  return {
    kind: "category",
    weight: 10,
    enabled: true,
    ...partial,
  };
}

test("scoreCreatorCampaignRelevance returns weighted partial match percentage", () => {
  const creator = sampleCreator();
  const criteria: CampaignSearchCriterion[] = [
    criterion({
      id: "1",
      label: "Category",
      value: "Beauty",
      kind: "category",
      weight: 20,
      meta: { discoveryKey: "category", rawValue: "beauty" },
    }),
    criterion({
      id: "2",
      label: "Audience Country",
      value: "Egypt",
      kind: "country",
      weight: 20,
      meta: { discoveryKey: "audience_country", rawValue: "EG" },
    }),
    criterion({
      id: "3",
      label: "Platform",
      value: "instagram",
      kind: "platform",
      weight: 20,
      meta: { discoveryKey: "platform", rawValue: "instagram" },
    }),
    criterion({
      id: "4",
      label: "Niche",
      value: "luxury",
      kind: "niche",
      weight: 20,
      meta: { discoveryKey: "niche", rawValue: "luxury" },
    }),
    criterion({
      id: "5",
      label: "Engagement",
      value: "2",
      kind: "engagement",
      weight: 20,
      meta: { discoveryKey: "engagement_min", rawValue: "2" },
    }),
  ];

  const breakdown = scoreCreatorCampaignRelevance(creator, criteria);
  assert.equal(breakdown.criterionCount, 5);
  assert.equal(breakdown.matchedCount, 4);
  assert.equal(breakdown.score, 80);
});

test("rankCreatorsByCampaignRelevance never returns empty when creators exist", () => {
  const weak = sampleCreator({
    unified_id: "inf:weak",
    display_name: "Generic Creator",
    country_code: "US",
    categories: [],
    audience_interests: [],
    bio: "Random posts",
    platforms: [
      {
        platform: "tiktok",
        handle: "random",
        follower_count: 5000,
        engagement_rate: 1,
        audience_country: "US",
        profile_picture_url: null,
        platform_account_id: "pa-2",
        url: null,
        is_verified: false,
        avg_views: 500,
      },
    ],
  });
  const strong = sampleCreator();

  const criteria: CampaignSearchCriterion[] = [
    criterion({
      id: "1",
      label: "Audience Country",
      value: "Egypt",
      kind: "country",
      weight: 50,
      meta: { discoveryKey: "audience_country", rawValue: "EG" },
    }),
    criterion({
      id: "2",
      label: "Category",
      value: "Beauty",
      kind: "category",
      weight: 50,
      meta: { discoveryKey: "category", rawValue: "beauty" },
    }),
  ];

  const ranked = rankCreatorsByCampaignRelevance([weak, strong], criteria);
  assert.ok(ranked.length > 0);
  assert.equal(ranked[0]?.unified_id, "inf:test");
  assert.equal(ranked[0]?.campaign_relevance_score, 100);
});

test("isCampaignRelevanceSearchActive requires AI mode and enabled criteria", () => {
  const criteria = [
    criterion({
      id: "1",
      label: "Country",
      value: "Egypt",
      kind: "country",
      enabled: true,
    }),
  ];

  assert.equal(isCampaignRelevanceSearchActive(false, criteria), false);
  assert.equal(isCampaignRelevanceSearchActive(true, []), false);
  assert.equal(
    isCampaignRelevanceSearchActive(true, [{ ...criteria[0]!, enabled: false }]),
    false
  );
  assert.equal(isCampaignRelevanceSearchActive(true, criteria), true);
});
