import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  applyDiscoveryBrowseFilters,
  creatorMatchesDiscoveryBrowseFilters,
  hasDiscoveryAudienceBrowseFilters,
} from "@/lib/creators/discovery-browse-filters";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

function makeCreator(
  partial: Partial<UnifiedCreatorResult> & Pick<UnifiedCreatorResult, "unified_id">
): UnifiedCreatorResult {
  return {
    source_type: "imported",
    influencer_id: partial.unified_id.replace("inf:", ""),
    discovered_profile_id: null,
    document_number: "TW-TEST-1",
    display_name: "Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    metrics: {
      followers: { value: 1000, confidence: "verified" },
      engagement_rate: { value: 1.2, confidence: "verified" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 50,
    source_confidence: 80,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    bio: null,
    ...partial,
  };
}

test("hasDiscoveryAudienceBrowseFilters detects audience chips", () => {
  assert.equal(hasDiscoveryAudienceBrowseFilters({}), false);
  assert.equal(
    hasDiscoveryAudienceBrowseFilters({ audienceCountries: ["AE"] }),
    true
  );
  assert.equal(
    hasDiscoveryAudienceBrowseFilters({ audienceInterestTags: ["Beauty"] }),
    true
  );
});

test("creatorMatchesDiscoveryBrowseFilters enforces audience interest tags", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    audienceInterestTags: ["beauty & cosmetics"],
  };
  const match = makeCreator({
    unified_id: "inf:1",
    audience_interests: ["Beauty & Cosmetics"],
  });
  const miss = makeCreator({
    unified_id: "inf:2",
    audience_interests: ["Sports"],
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(match, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(miss, filters), false);
  assert.equal(applyDiscoveryBrowseFilters([match, miss], filters).length, 1);
});

test("creatorMatchesDiscoveryBrowseFilters matches secondary country_codes entries", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    country: "CH",
  };
  const swissInList = makeCreator({
    unified_id: "inf:1",
    country_code: "AE",
    country_codes: ["AE", "CH", "TH"],
  });
  const noMatch = makeCreator({
    unified_id: "inf:2",
    country_code: "EG",
    country_codes: ["EG"],
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(swissInList, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(noMatch, filters), false);
});

test("creatorMatchesDiscoveryBrowseFilters accepts UAE via creator country fallback", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    audienceCountries: ["AE"],
  };
  const uaeCreator = makeCreator({
    unified_id: "inf:1",
    country_code: "AE",
    estimated_country: "AE",
  });
  const egCreator = makeCreator({
    unified_id: "inf:2",
    country_code: "EG",
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(uaeCreator, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(egCreator, filters), false);
});

test("creatorMatchesDiscoveryBrowseFilters accepts platform via filters.platform singular", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    platform: "instagram",
  };
  const match = makeCreator({
    unified_id: "inf:1",
    platforms: [
      {
        id: "pa-1",
        platform: "instagram",
        handle: "creator",
        profile_url: null,
        follower_count: 1000,
        engagement_rate: 1,
        audience_country: "EG",
        is_verified: false,
      },
    ],
  });
  const miss = makeCreator({
    unified_id: "inf:2",
    platforms: [
      {
        id: "pa-2",
        platform: "tiktok",
        handle: "creator",
        profile_url: null,
        follower_count: 1000,
        engagement_rate: 1,
        audience_country: "EG",
        is_verified: false,
      },
    ],
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(match, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(miss, filters), false);
});

test("creatorMatchesDiscoveryBrowseFilters uses enriched demographics for gender", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    audienceGender: "female",
    audienceAgeMin: "25",
    audienceAgeMax: "34",
  };
  const match = makeCreator({
    unified_id: "inf:1",
    audience_demographics: {
      age: { "13_17": 5, "18_24": 10, "25_34": 55, "35_44": 20, "45_54": 5, "55_plus": 5 },
      gender: { male: 20, female: 78, unknown: 2 },
      topCountries: [{ code: "AE", name: "United Arab Emirates", percent: 60 }],
      topCities: null,
      source: "modash",
    },
  });
  const miss = makeCreator({
    unified_id: "inf:2",
    audience_demographics: {
      age: { "13_17": 5, "18_24": 55, "25_34": 20, "35_44": 10, "45_54": 5, "55_plus": 5 },
      gender: { male: 70, female: 28, unknown: 2 },
      topCountries: [{ code: "AE", name: "United Arab Emirates", percent: 60 }],
      topCities: null,
      source: "modash",
    },
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(match, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(miss, filters), false);
});
