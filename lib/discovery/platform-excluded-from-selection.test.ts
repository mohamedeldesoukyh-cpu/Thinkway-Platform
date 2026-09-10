/**
 * Platform must not contribute to any score that selects creators.
 *
 * Platform was scored like any other campaign criterion, and because
 * `composeCreatorSlate` gates on that score at its fit floor and sorts by it,
 * a platform match changed WHICH creators were recommended. Platform stays a
 * filter, a mandatory slate gate and displayed context.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  attachCampaignRelevanceScores,
  isSelectionScoringCriterion,
  rankCreatorsByCampaignRelevance,
  scoreCreatorCampaignRelevance,
} from "./campaign-relevance-scoring";

function creator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:1",
    source_type: "internal",
    influencer_id: "1",
    discovered_profile_id: null,
    display_name: "Creator One",
    bio: null,
    profile_image_url: null,
    country_code: "EG",
    country_codes: ["EG"],
    estimated_country: "EG",
    categories: ["beauty"],
    browse_category_tags: ["beauty"],
    ai_category: "beauty",
    ai_niche: null,
    platforms: [
      {
        id: "p1",
        platform: "instagram",
        handle: "creator_one",
        follower_count: 120_000,
        engagement_rate: 3.2,
        audience_country: "EG",
        is_verified: false,
      },
    ],
    metrics: {
      followers: { value: 120_000, source: "platform", confidence: 90 },
      engagement_rate: { value: 3.2, source: "platform", confidence: 90 },
      avg_likes: { value: 3_000, source: "platform", confidence: 80 },
      posting_frequency_per_week: { value: 3, source: "platform", confidence: 70 },
    },
    source_confidence: 85,
    thinkway_score: 70,
    brand_fit_score: null,
    eci_investment_score: null,
    ...overrides,
  } as unknown as UnifiedCreatorResult;
}

function criterion(
  kind: CampaignSearchCriterion["kind"],
  value: string,
  discoveryKey?: string
): CampaignSearchCriterion {
  return {
    id: `${kind}:${value}`,
    kind,
    label: kind,
    value,
    weight: 100,
    enabled: true,
    ...(discoveryKey ? { meta: { discoveryKey } } : {}),
  };
}

test("a platform criterion is not a scoring criterion, by kind or by filter key", () => {
  assert.equal(isSelectionScoringCriterion(criterion("platform", "instagram")), false);
  assert.equal(
    isSelectionScoringCriterion(criterion("category", "instagram", "platform")),
    false,
    "the Discovery filter key decides too — CSR projects platform under it"
  );
  assert.equal(isSelectionScoringCriterion(criterion("category", "beauty", "category")), true);
  assert.equal(isSelectionScoringCriterion(criterion("country", "EG", "creator_country")), true);
});

test("being on the campaign platform earns no score", () => {
  const onPlatform = creator();
  const offPlatform = creator({
    unified_id: "inf:2",
    platforms: [
      {
        id: "p2",
        platform: "tiktok",
        handle: "creator_two",
        follower_count: 120_000,
        engagement_rate: 3.2,
        audience_country: "EG",
        is_verified: false,
      },
    ],
  } as Partial<UnifiedCreatorResult>);

  const criteria = [criterion("category", "beauty", "category"), criterion("platform", "instagram")];

  const onScore = scoreCreatorCampaignRelevance(onPlatform, criteria).score;
  const offScore = scoreCreatorCampaignRelevance(offPlatform, criteria).score;

  assert.equal(onScore, offScore, "platform cannot separate two otherwise identical creators");
  assert.equal(onScore, 100, "the category match alone is the whole score");
});

test("a platform criterion alone leaves nothing to score, and cannot rank", () => {
  const breakdown = scoreCreatorCampaignRelevance(creator(), [
    criterion("platform", "instagram"),
  ]);
  assert.equal(breakdown.criterionCount, 0, "no scoring criterion remains");
  assert.equal(breakdown.score, 100, "an unscoreable set is not a penalty");
});

test("ranking order is unchanged by platform", () => {
  const instagram = creator({ unified_id: "inf:ig" });
  const tiktok = creator({
    unified_id: "inf:tt",
    platforms: [
      {
        id: "p3",
        platform: "tiktok",
        handle: "tt",
        follower_count: 500_000,
        engagement_rate: 5,
        audience_country: "EG",
        is_verified: false,
      },
    ],
  } as Partial<UnifiedCreatorResult>);

  const withPlatform = rankCreatorsByCampaignRelevance(
    [tiktok, instagram],
    [criterion("category", "beauty", "category"), criterion("platform", "instagram")]
  ).map((c) => c.unified_id);
  const withoutPlatform = rankCreatorsByCampaignRelevance(
    [tiktok, instagram],
    [criterion("category", "beauty", "category")]
  ).map((c) => c.unified_id);

  assert.deepEqual(withPlatform, withoutPlatform);
});

test("the other campaign criteria still score, so selection is not blunted", () => {
  const onBrief = creator();
  const offBrief = creator({
    unified_id: "inf:3",
    categories: ["gaming"],
    browse_category_tags: ["gaming"],
    ai_category: "gaming",
  } as Partial<UnifiedCreatorResult>);

  const criteria = [criterion("category", "beauty", "category")];
  const [scoredOn] = attachCampaignRelevanceScores([onBrief], criteria);
  const [scoredOff] = attachCampaignRelevanceScores([offBrief], criteria);

  assert.ok(
    (scoredOn!.campaign_relevance_score ?? 0) > (scoredOff!.campaign_relevance_score ?? 0),
    "category fit must still separate creators"
  );
});
