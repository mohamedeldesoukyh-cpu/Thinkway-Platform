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
    source_type: "internal",
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
        id: "pa-1",
        platform: "instagram",
        handle: "beauty_eg",
        profile_url: null,
        follower_count: 120_000,
        engagement_rate: 3.2,
        audience_country: "EG",
        profile_picture_url: null,
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
        id: "pa-2",
        platform: "tiktok",
        handle: "random",
        profile_url: null,
        follower_count: 5000,
        engagement_rate: 1,
        audience_country: "US",
        profile_picture_url: null,
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

test("unknown creator data discounts relevance instead of counting as a mismatch", () => {
  // On-brief creator with sparse DNA: every field we KNOW matches the brief.
  const sparsePerfectFit = sampleCreator({
    unified_id: "inf:sparse-perfect",
    display_name: "Sparse Perfect Fit",
    country_code: "SA",
    estimated_country: "SA",
    categories: ["beauty"],
    browse_category_tags: ["beauty"],
    audience_interests: ["skincare"],
    bio: "Saudi skincare and beauty routines",
    ai_category: "Beauty",
    ai_niche: "Skincare",
    thinkway_score: 25,
    brand_fit_score: null,
    authenticity_score: null,
    language_codes: [],
    audience_demographics: undefined,
    metrics: {
      followers: { value: null, confidence: "estimated" },
      engagement_rate: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    platforms: [
      {
        id: "p-sparse",
        platform: "instagram",
        handle: "ksa_skin",
        profile_url: null,
        follower_count: null,
        engagement_rate: null,
        audience_country: "SA",
        profile_picture_url: null,
        is_verified: false,
        avg_views: null,
      },
    ],
  });

  // Off-brief creator with rich DNA: wrong content, every data field populated.
  const enrichedOffBrief = sampleCreator({
    unified_id: "inf:enriched-offbrief",
    display_name: "Enriched Off-Brief",
    country_code: "SA",
    estimated_country: "SA",
    categories: ["lifestyle", "travel"],
    browse_category_tags: ["lifestyle"],
    audience_interests: ["travel", "food"],
    bio: "Travel vlogs and lifestyle from Riyadh",
    ai_category: "Lifestyle",
    ai_niche: "Travel",
    thinkway_score: 92,
    brand_fit_score: 75,
    language_codes: ["ar", "en"],
    audience_demographics: {
      source: "provider",
      gender: { male: 28, female: 72 },
      age_bands: { "18-24": 40, "25-34": 35 },
    } as never,
    platforms: [
      {
        id: "p-rich",
        platform: "instagram",
        handle: "riyadh_life",
        profile_url: null,
        follower_count: 480_000,
        engagement_rate: 3.4,
        audience_country: "SA",
        profile_picture_url: null,
        is_verified: true,
        avg_views: 60_000,
      },
    ],
  });

  const briefCriteria: CampaignSearchCriterion[] = [
    criterion({ id: "1", kind: "category", label: "Category", value: "Beauty", weight: 100, meta: { discoveryKey: "category", rawValue: "beauty" } }),
    criterion({ id: "2", kind: "country", label: "Country", value: "Saudi Arabia", weight: 90, meta: { discoveryKey: "creator_country", rawValue: "SA" } }),
    criterion({ id: "3", kind: "niche", label: "Niche", value: "skincare", weight: 80, meta: { discoveryKey: "niche", rawValue: "skincare" } }),
    criterion({ id: "4", kind: "audience", label: "Audience gender", value: "female", weight: 80, meta: { discoveryKey: "audience_gender", rawValue: "female" } }),
    criterion({ id: "5", kind: "brand_fit", label: "Brand fit", value: "65", weight: 70, meta: { discoveryKey: "brand_fit_min", rawValue: "65" } }),
    criterion({ id: "6", kind: "language", label: "Language", value: "ar", weight: 60, meta: { discoveryKey: "language", rawValue: "ar" } }),
    criterion({ id: "7", kind: "platform", label: "Platform", value: "instagram", weight: 60, meta: { discoveryKey: "platform", rawValue: "instagram" } }),
    criterion({ id: "8", kind: "engagement", label: "Engagement", value: "2", weight: 50, meta: { discoveryKey: "engagement_min", rawValue: "2" } }),
  ];

  const sparse = scoreCreatorCampaignRelevance(sparsePerfectFit, briefCriteria);
  const enriched = scoreCreatorCampaignRelevance(enrichedOffBrief, briefCriteria);

  // Sparse creator matches all 4 criteria it has data for; 4 are unknown, 0 proven mismatches.
  assert.equal(sparse.matchedCount, 4);
  assert.equal(sparse.unknownCount, 4);
  assert.equal(sparse.knownWeight, sparse.matchedWeight);
  // Enriched creator has zero unknowns but fails the campaign-defining content criteria.
  assert.equal(enriched.unknownCount, 0);
  assert.ok(enriched.matchedCount >= 5);
  // Fit must beat completeness: the on-brief sparse creator ranks first.
  assert.ok(
    sparse.score > enriched.score,
    `sparse perfect fit (${sparse.score}) must outrank enriched off-brief (${enriched.score})`
  );

  const ranked = rankCreatorsByCampaignRelevance(
    [enrichedOffBrief, sparsePerfectFit],
    briefCriteria,
    { minScore: 30 }
  );
  assert.equal(ranked[0]?.unified_id, "inf:sparse-perfect");
});

test("brand fit criterion never falls back to thinkway_score", () => {
  const noBrandFit = sampleCreator({
    unified_id: "inf:no-brand-fit",
    brand_fit_score: null,
    thinkway_score: 99,
  });
  const criteria = [
    criterion({ id: "1", kind: "luxury", label: "Brand fit", value: "65", weight: 10, meta: { discoveryKey: "brand_fit_min", rawValue: "65" } }),
  ];
  const breakdown = scoreCreatorCampaignRelevance(noBrandFit, criteria);
  // Unknown, not a thinkway_score-backed match.
  assert.equal(breakdown.matchedCount, 0);
  assert.equal(breakdown.unknownCount, 1);
});

test("creator with no data at all scores zero, not one hundred", () => {
  const empty = sampleCreator({
    unified_id: "inf:empty",
    country_code: null,
    estimated_country: null,
    categories: [],
    browse_category_tags: [],
    audience_interests: [],
    language_codes: [],
    bio: null,
    ai_category: null,
    ai_niche: null,
    brand_fit_score: null,
    authenticity_score: null,
    platforms: [],
    metrics: {
      followers: { value: null, confidence: "estimated" },
      engagement_rate: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
  });
  const criteria = [
    criterion({ id: "1", kind: "country", label: "Country", value: "Egypt", weight: 10, meta: { discoveryKey: "creator_country", rawValue: "EG" } }),
    criterion({ id: "2", kind: "platform", label: "Platform", value: "instagram", weight: 10, meta: { discoveryKey: "platform", rawValue: "instagram" } }),
  ];
  const breakdown = scoreCreatorCampaignRelevance(empty, criteria);
  assert.equal(breakdown.score, 0);
  assert.equal(breakdown.unknownCount, 2);
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
