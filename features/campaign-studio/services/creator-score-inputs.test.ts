/**
 * Creator Score inputs and weights, pinned.
 *
 * The Thinkway score is a generic creator-quality score computed from
 * engagement, posting consistency, authenticity, profile completeness, brand
 * fit, reach band and source confidence. It is NOT the campaign fit score, and
 * it is not what selects creators — these tests pin both the weights and that
 * separation, so a future change to either is deliberate.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  computeThinkwayScore,
  profileCompletenessPercent,
} from "@/lib/creators/thinkway-score";
import { studioCreatorRankingScore, studioCreatorRequirementScore } from "./studio-creator-requirements";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

/**
 * `confidence` on a metric is a LEVEL, not a percentage — the score maps
 * estimated/inferred/verified/oauth_verified to 35/60/85/95 internally.
 */
function metric(value: number | null, confidence = "verified") {
  return { value, source: "platform", confidence } as never;
}

/**
 * A mid-range creator. Deliberately not a strong one: the score saturates at
 * 100 well before its inputs max out, and a saturated baseline would hide
 * every weight change behind the clamp.
 */
function scoreInput(overrides?: Record<string, unknown>) {
  return {
    metrics: {
      followers: metric(20_000),
      engagement_rate: metric(1.5),
      posting_frequency_per_week: metric(2),
      avg_likes: metric(400),
    },
    authenticity_score: null,
    brand_fit_score: null,
    profile_completeness: 60,
    ai_category: "beauty",
    ai_niche: null,
    bio: "Haircare creator",
    profile_image_url: "https://example.test/a.jpg",
    platforms_count: 1,
    ...overrides,
  } as never;
}

test("each documented input moves the score in the documented direction", () => {
  const base = computeThinkwayScore(scoreInput());

  assert.ok(
    computeThinkwayScore(
      scoreInput({
        metrics: {
          followers: metric(20_000),
          engagement_rate: metric(3),
          posting_frequency_per_week: metric(2),
          avg_likes: metric(400),
        },
      })
    ) > base,
    "engagement quality raises the score"
  );
  assert.ok(
    computeThinkwayScore(scoreInput({ profile_completeness: 40 })) < base,
    "profile completeness contributes"
  );
  assert.ok(
    computeThinkwayScore(scoreInput({ authenticity_score: 100 })) > base,
    "authenticity contributes"
  );
  assert.ok(
    computeThinkwayScore(scoreInput({ brand_fit_score: 100 })) > base,
    "brand fit contributes"
  );
});

test("missing authenticity and brand fit are defaulted, not zeroed", () => {
  // Documented behaviour: authenticity defaults to 70 and brand fit to 50, so a
  // sparse creator is not scored as if it had failed those checks.
  const withDefaults = computeThinkwayScore(scoreInput());
  const withExplicit = computeThinkwayScore(
    scoreInput({ authenticity_score: 70, brand_fit_score: 50 })
  );
  assert.equal(withDefaults, withExplicit);

  const zeroed = computeThinkwayScore(scoreInput({ authenticity_score: 0, brand_fit_score: 0 }));
  assert.ok(zeroed < withDefaults, "an explicit zero is worse than an absent value");
});

test("the score stays inside 0–100 at both extremes", () => {
  const floor = computeThinkwayScore(
    scoreInput({
      metrics: {
        followers: metric(0),
        engagement_rate: metric(0),
        posting_frequency_per_week: metric(0),
        avg_likes: metric(0),
      },
      authenticity_score: 0,
      brand_fit_score: 0,
      profile_completeness: 0,
    })
  );
  const ceiling = computeThinkwayScore(
    scoreInput({
      metrics: {
        followers: metric(50_000_000),
        engagement_rate: metric(40),
        posting_frequency_per_week: metric(20),
        avg_likes: metric(1_000_000),
      },
      authenticity_score: 100,
      brand_fit_score: 100,
      profile_completeness: 100,
    })
  );

  assert.ok(floor >= 0 && floor <= 100, `floor ${floor}`);
  assert.equal(ceiling, 100);
});

test("profile completeness counts stated profile fields, platform presence included", () => {
  // Documented: having at least one platform account is 20 of the completeness
  // percent — profile completeness, not campaign platform fit.
  const complete = profileCompletenessPercent({
    display_name: "Creator",
    bio: "bio",
    profile_image_url: "https://example.test/a.jpg",
    platforms_count: 1,
    country_code: "EG",
    categories: ["beauty"],
  });
  const noPlatform = profileCompletenessPercent({
    display_name: "Creator",
    bio: "bio",
    profile_image_url: "https://example.test/a.jpg",
    platforms_count: 0,
    country_code: "EG",
    categories: ["beauty"],
  });

  assert.equal(complete, 100);
  assert.equal(noPlatform, 80);
});

// ---------------------------------------------------------------------------
// The Studio requirement score: badge counts platform, ranking does not.

const FACTS: CampaignFacts = {
  geography: ["Egypt"],
  platforms: ["instagram", "tiktok"],
  industry: "Beauty & Personal Care",
  objective: "Drive Consideration & Conversion",
  audience: "Women aged 20–40 in Egypt interested in premium haircare",
  rawBriefExcerpt: "premium haircare campaign for beauty creators in Egypt",
  extractedAt: "",
  confidence: {},
  sources: {},
};

const ON_PLATFORM = {
  country: "Egypt",
  countryCode: "EG",
  platform: "instagram",
  categories: ["beauty"],
  audienceSummary: "Egyptian beauty audience",
  handle: "creator_one",
  displayName: "Creator One",
};

test("the requirements badge still counts platform — it is operator context", () => {
  const onPlatform = studioCreatorRequirementScore(ON_PLATFORM, FACTS);
  const offPlatform = studioCreatorRequirementScore(
    { ...ON_PLATFORM, platform: "youtube" },
    FACTS
  );

  assert.equal(onPlatform.total, offPlatform.total, "the same rows are checked");
  assert.ok(onPlatform.met > offPlatform.met, "the badge shows the platform miss");
});

test("the ranking score ignores platform entirely", () => {
  const onPlatform = studioCreatorRankingScore(ON_PLATFORM, FACTS);
  const offPlatform = studioCreatorRankingScore({ ...ON_PLATFORM, platform: "youtube" }, FACTS);

  assert.deepEqual(onPlatform, offPlatform, "platform cannot reorder the recommendations");
  assert.ok(onPlatform.total < studioCreatorRequirementScore(ON_PLATFORM, FACTS).total);
});

test("market and category still drive the ranking score", () => {
  const onBrief = studioCreatorRankingScore(ON_PLATFORM, FACTS);
  const offMarket = studioCreatorRankingScore(
    { ...ON_PLATFORM, country: "Nigeria", countryCode: "NG" },
    FACTS
  );

  assert.ok(onBrief.ratio > offMarket.ratio, "market is still decisive");
});
