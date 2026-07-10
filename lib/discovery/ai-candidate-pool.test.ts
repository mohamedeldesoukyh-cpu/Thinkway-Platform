import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  AI_CANDIDATE_POOL_LIMIT,
  mergeAiCandidatePools,
} from "@/lib/discovery/ai-candidate-pool";
import { rankCreatorsByCampaignRelevance } from "@/lib/discovery/campaign-relevance-scoring";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";

function creator(
  unifiedId: string,
  overrides: Partial<UnifiedCreatorResult> = {}
): UnifiedCreatorResult {
  return {
    unified_id: unifiedId,
    source_type: "internal",
    influencer_id: unifiedId,
    discovered_profile_id: null,
    document_number: null,
    display_name: unifiedId,
    status: "active",
    country_code: null,
    estimated_country: null,
    city: null,
    categories: [],
    browse_category_tags: [],
    audience_interests: [],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: null, confidence: "estimated" },
      engagement_rate: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 0,
    source_confidence: 0.5,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    ...overrides,
  } as UnifiedCreatorResult;
}

test("mergeAiCandidatePools dedupes by unified_id keeping strict results first", () => {
  const strict = [creator("inf:a", { thinkway_score: 10 }), creator("inf:b")];
  const relaxed = [creator("inf:a", { thinkway_score: 99 }), creator("inf:c")];

  const merged = mergeAiCandidatePools(strict, relaxed);

  assert.deepEqual(
    merged.map((c) => c.unified_id),
    ["inf:a", "inf:b", "inf:c"]
  );
  // The strict-pool row wins the dedupe.
  assert.equal(merged[0]?.thinkway_score, 10);
});

test("mergeAiCandidatePools respects the pool limit and skips empty ids", () => {
  const strict = Array.from({ length: 10 }, (_, i) => creator(`inf:s${i}`));
  const relaxed = Array.from({ length: 10 }, (_, i) => creator(`inf:r${i}`));
  relaxed.push(creator("")); // malformed row must not throw or count

  const merged = mergeAiCandidatePools(strict, relaxed, 12);
  assert.equal(merged.length, 12);
  assert.equal(mergeAiCandidatePools([], [], 5).length, 0);
  assert.ok(AI_CANDIDATE_POOL_LIMIT >= 400);
});

test("dual pool rescues on-brief creators absent from the thinkway_score-ordered relaxed page", () => {
  // Simulate the D2 defect: relaxed page = top-200 by thinkway_score, all generic.
  const relaxedPage: UnifiedCreatorResult[] = Array.from({ length: 200 }, (_, i) =>
    creator(`inf:generic-${i}`, {
      country_code: "AE",
      categories: ["lifestyle"],
      ai_category: "Lifestyle",
      thinkway_score: 50 + (i % 45),
      language_codes: ["en"],
      platforms: [
        {
          id: `pg${i}`,
          platform: "instagram",
          handle: `gen${i}`,
          profile_url: null,
          follower_count: 100_000,
          engagement_rate: 2.5,
          audience_country: "AE",
          profile_picture_url: null,
          is_verified: false,
          avg_views: 10_000,
        },
      ],
    })
  );

  // The on-brief creator ranks below the relaxed page cut by thinkway_score,
  // but the strict (brief-filtered) pool contains her.
  const perfectFit = creator("inf:sparse-perfect", {
    display_name: "Sparse Perfect Fit",
    country_code: "SA",
    categories: ["beauty"],
    browse_category_tags: ["beauty"],
    audience_interests: ["skincare"],
    bio: "Saudi skincare and beauty routines",
    ai_category: "Beauty",
    ai_niche: "Skincare",
    thinkway_score: 25,
    platforms: [
      {
        id: "p1",
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
  const strictPage = [perfectFit];

  const criteria: CampaignSearchCriterion[] = [
    { id: "1", kind: "category", label: "Category", value: "Beauty", weight: 100, enabled: true, meta: { discoveryKey: "category", rawValue: "beauty" } },
    { id: "2", kind: "country", label: "Country", value: "Saudi Arabia", weight: 90, enabled: true, meta: { discoveryKey: "creator_country", rawValue: "SA" } },
    { id: "3", kind: "niche", label: "Niche", value: "skincare", weight: 80, enabled: true, meta: { discoveryKey: "niche", rawValue: "skincare" } },
    { id: "4", kind: "platform", label: "Platform", value: "instagram", weight: 60, enabled: true, meta: { discoveryKey: "platform", rawValue: "instagram" } },
  ];

  // Old behavior (relaxed pool only): best fit absent entirely.
  const relaxedOnly = rankCreatorsByCampaignRelevance(relaxedPage, criteria, { minScore: 30 });
  assert.equal(
    relaxedOnly.some((c) => c.unified_id === "inf:sparse-perfect"),
    false
  );

  // New behavior (merged pool): best fit present AND first.
  const merged = mergeAiCandidatePools(strictPage, relaxedPage);
  const ranked = rankCreatorsByCampaignRelevance(merged, criteria, { minScore: 30 });
  assert.equal(ranked[0]?.unified_id, "inf:sparse-perfect");
});
