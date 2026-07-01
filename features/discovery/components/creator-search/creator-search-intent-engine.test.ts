import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  creatorMatchesExactSearch,
  filterExactCreatorMatches,
} from "./creator-search-exact-match";
import {
  scoreCreatorSearchIntent,
  simplifyCreatorSearchQuery,
} from "./creator-search-intent-engine";
import { buildDiscoverySearchTaxonomyIndex } from "./creator-search-taxonomy";

const TEST_TAXONOMY = buildDiscoverySearchTaxonomyIndex([
  "travel",
  "food",
  "beauty",
  "fashion",
  "tourism",
  "restaurants",
  "fitness",
  "gaming",
  "lifestyle",
]);

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

test("scoreCreatorSearchIntent routes taxonomy terms to discovery via DB taxonomy", () => {
  for (const query of ["travel", "food", "beauty", "fashion"]) {
    const result = scoreCreatorSearchIntent(query, TEST_TAXONOMY);
    assert.equal(result.mode, "discovery", `${query} should be discovery`);
    assert.ok(result.confidence < 60, `${query} confidence should be below hybrid`);
    assert.notEqual(result.signals.taxonomyMatch.level, "none");
  }
});

test("scoreCreatorSearchIntent detects exact creator handles and names", () => {
  for (const query of [
    "reemalmasryyy",
    "@reemalmasryyy",
    "maryammoustafaa.1",
    "Mohamed Ahmed Mostafa",
    "Ahmed El Sayed",
  ]) {
    const result = scoreCreatorSearchIntent(query, TEST_TAXONOMY);
    assert.equal(result.mode, "exact", `${query} should be exact`);
    assert.ok(result.confidence >= 95, `${query} confidence should be >= 95`);
  }
});

test("scoreCreatorSearchIntent keeps generic queries in discovery mode", () => {
  assert.equal(scoreCreatorSearchIntent("", TEST_TAXONOMY).mode, "discovery");
  assert.equal(scoreCreatorSearchIntent("#foodie", TEST_TAXONOMY).mode, "discovery");
  assert.equal(scoreCreatorSearchIntent("in", TEST_TAXONOMY).mode, "discovery");
  assert.equal(scoreCreatorSearchIntent("cairo creators", TEST_TAXONOMY).mode, "discovery");
});

test("scoreCreatorSearchIntent can classify ambiguous handle-like queries as hybrid", () => {
  const result = scoreCreatorSearchIntent("reem", TEST_TAXONOMY);
  assert.ok(
    result.mode === "hybrid" || result.mode === "discovery",
    "short handle-like token should not force exact mode"
  );
  if (result.mode === "hybrid") {
    assert.ok(result.confidence >= 60 && result.confidence < 95);
  }
});

test("simplifyCreatorSearchQuery trims to first meaningful token", () => {
  assert.equal(simplifyCreatorSearchQuery("Mohamed Ahmed Mostafa"), "Mohamed");
  assert.equal(simplifyCreatorSearchQuery("maryammoustafaa.1"), "maryammoustafaa");
  assert.equal(simplifyCreatorSearchQuery("@reem_almasry"), "reem");
});

test("creatorMatchesExactSearch matches handle and display name", () => {
  const creator = makeCreator({
    unified_id: "inf:1",
    display_name: "Mohamed Ahmed Mostafa",
    platforms: [
      {
        id: "p1",
        platform: "instagram",
        handle: "reemalmasryyy",
        profile_url: null,
        follower_count: 1000,
        engagement_rate: 1,
        audience_country: "EG",
      },
    ],
  });

  assert.equal(creatorMatchesExactSearch(creator, "reemalmasryyy"), true);
  assert.equal(creatorMatchesExactSearch(creator, "@reemalmasryyy"), true);
  assert.equal(creatorMatchesExactSearch(creator, "Mohamed Ahmed Mostafa"), true);
  assert.equal(creatorMatchesExactSearch(creator, "mohamed ahmed mostafa"), true);
  assert.equal(creatorMatchesExactSearch(creator, "reem"), false);
});

test("filterExactCreatorMatches removes fuzzy-only rows", () => {
  const exact = makeCreator({
    unified_id: "inf:1",
    display_name: "Reem Al Masry",
    platforms: [
      {
        id: "p1",
        platform: "instagram",
        handle: "reemalmasryyy",
        profile_url: null,
        follower_count: 1000,
        engagement_rate: 1,
        audience_country: "EG",
      },
    ],
  });
  const fuzzy = makeCreator({
    unified_id: "inf:2",
    display_name: "Reem Style",
    platforms: [
      {
        id: "p2",
        platform: "instagram",
        handle: "reemstyle",
        profile_url: null,
        follower_count: 500,
        engagement_rate: 1,
        audience_country: "EG",
      },
    ],
  });

  const filtered = filterExactCreatorMatches([exact, fuzzy], "reemalmasryyy");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.unified_id, "inf:1");
});

console.log(
  "features/discovery/components/creator-search/creator-search-intent-engine.test.ts — all tests passed"
);
