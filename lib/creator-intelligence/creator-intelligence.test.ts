import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  categoriesIntersect,
  meetsBrandSafetyMinimum,
  resolveCanonicalCategories,
  resolveCanonicalCategory,
  resolveLanguageCodes,
  resolveTopics,
} from "./taxonomy";
import { resolveCreatorIntelligence } from "./resolver";
import {
  campaignRequirementsFromFacts,
  matchCreatorsToCampaign,
  matchCreatorToCampaign,
} from "./matching";
import { evaluateIntelligenceCoverage } from "./coverage";
import { compareCategoryFiltering, creatorIntelligenceMatchesCategories } from "./shadow";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

// --- fixtures ------------------------------------------------------------------

function baseCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  const creator = {
    unified_id: "dis:test-1",
    source_type: "public_discovery",
    influencer_id: null,
    discovered_profile_id: "test-1",
    document_number: null,
    display_name: "Test Creator",
    status: null,
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    language_codes: ["ar"],
    profile_image_url: null,
    bio: null,
    metrics: {} as UnifiedCreatorResult["metrics"],
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 70,
    source_confidence: 0.8,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [
      {
        platform: "tiktok",
        follower_count: 250_000,
        engagement_rate: 4.2,
      } as UnifiedCreatorResult["platforms"][number],
    ],
  } satisfies Partial<UnifiedCreatorResult> as UnifiedCreatorResult;
  return { ...creator, ...overrides };
}

const facts = {
  brandName: "e&",
  platforms: ["TikTok"],
  geography: ["Egypt"],
  extractedAt: new Date().toISOString(),
  confidence: {},
  sources: {},
} satisfies CampaignFacts;

// --- taxonomy ------------------------------------------------------------------

function testTaxonomy(): void {
  // case-insensitive canonical categories + keyword aliases
  assert.equal(resolveCanonicalCategory("lifestyle"), "Lifestyle");
  assert.equal(resolveCanonicalCategory("LIFESTYLE"), "Lifestyle");
  assert.equal(resolveCanonicalCategory("comedy"), "Entertainment");
  assert.equal(resolveCanonicalCategory("not-a-category"), null);
  assert.deepEqual(
    resolveCanonicalCategories(["lifestyle", "Lifestyle", "comedy", "junk"]),
    ["Lifestyle", "Entertainment"]
  );
  assert.ok(categoriesIntersect(["entertainment"], ["Entertainment", "Beauty"]));
  assert.ok(!categoriesIntersect(["Beauty"], ["Travel"]));
  assert.ok(!categoriesIntersect([], ["Travel"]));

  // languages
  assert.deepEqual(resolveLanguageCodes(["Arabic", "EN", "ar-EG", "??"]), ["ar", "en"]);

  // topics
  assert.deepEqual(resolveTopics(["#DanceChallenge", "dance challenge", "ok"]), [
    "dancechallenge",
    "dance challenge",
  ]);

  // brand safety ordering — unknown never passes
  assert.ok(meetsBrandSafetyMinimum("safe", "moderate_risk"));
  assert.ok(!meetsBrandSafetyMinimum("high_risk", "moderate_risk"));
  assert.ok(!meetsBrandSafetyMinimum("unknown", "high_risk"));
}

// --- resolver ------------------------------------------------------------------

function testResolverIgnoresDiscoveryProvenance(): void {
  // Provenance-only tags on a discovered profile must NOT resolve as intelligence.
  const provenanceOnly = baseCreator({
    categories: ["Lifestyle", "Entertainment"],
    browse_category_tags: ["Lifestyle", "Entertainment"],
  });
  const ci = resolveCreatorIntelligence(provenanceOnly);
  assert.deepEqual(ci.categories.value, []);
  assert.equal(ci.categories.source, "unresolved");
}

function testResolverPrecedence(): void {
  // AI enrichment beats nothing; bio inference fills when AI absent.
  const aiScored = baseCreator({ ai_category: "entertainment", ai_niche: "comedy skits" });
  const aiCi = resolveCreatorIntelligence(aiScored);
  assert.deepEqual(aiCi.categories.value, ["Entertainment"]);
  assert.equal(aiCi.categories.source, "ai_enrichment");
  assert.equal(aiCi.niche.value, "comedy skits");

  const bioOnly = baseCreator({ bio: "Fitness coach sharing workout routines" });
  const bioCi = resolveCreatorIntelligence(bioOnly);
  assert.deepEqual(bioCi.categories.value, ["Fitness"]);
  assert.equal(bioCi.categories.source, "bio_inference");

  // Internal influencer stored categories ARE intelligence.
  const internal = baseCreator({
    unified_id: "inf:test-2",
    source_type: "internal",
    categories: ["beauty"],
    dna_completeness: 80,
  });
  const internalCi = resolveCreatorIntelligence(internal);
  assert.deepEqual(internalCi.categories.value, ["Beauty"]);
  assert.equal(internalCi.categories.source, "creator_dna");

  // platforms + metrics + audience
  assert.deepEqual(internalCi.platforms, ["tiktok"]);
  assert.equal(internalCi.metrics.maxFollowers, 250_000);
  assert.equal(internalCi.audience.primaryCountry.value, "EG");
  assert.deepEqual(internalCi.languages.value, ["ar"]);
  // brand safety defaults to unknown, never safe
  assert.equal(internalCi.brandSafety.level.value, "unknown");
}

// --- matching engine -------------------------------------------------------------

function testMatchingEngine(): void {
  const requirements = campaignRequirementsFromFacts(facts, {
    categories: ["Lifestyle", "Entertainment"],
  });
  assert.deepEqual(requirements.platforms, ["tiktok"]);
  assert.equal(requirements.country, "EG");
  assert.deepEqual(requirements.categories, ["Lifestyle", "Entertainment"]);

  const match = matchCreatorToCampaign(
    requirements,
    resolveCreatorIntelligence(baseCreator({ ai_category: "Entertainment" }))
  );
  assert.equal(match.eligible, true);
  assert.equal(match.score, 100);
  assert.ok(match.breakdown.some((b) => b.dimension === "category" && b.evaluation === "match"));

  // Unknown categories discount the score but never hard-fail.
  const unknownMatch = matchCreatorToCampaign(
    requirements,
    resolveCreatorIntelligence(baseCreator())
  );
  assert.equal(unknownMatch.eligible, true);
  assert.ok(unknownMatch.score < 100 && unknownMatch.score > 0);
  assert.ok(
    unknownMatch.breakdown.some((b) => b.dimension === "category" && b.evaluation === "unknown")
  );

  // Wrong platform is a hard mismatch.
  const wrongPlatform = matchCreatorToCampaign(
    requirements,
    resolveCreatorIntelligence(
      baseCreator({
        platforms: [
          { platform: "youtube", follower_count: 10_000 } as UnifiedCreatorResult["platforms"][number],
        ],
      })
    )
  );
  assert.equal(wrongPlatform.eligible, false);

  // Pool sorting: eligible full match ranks above unknown.
  const pool = matchCreatorsToCampaign(requirements, [
    resolveCreatorIntelligence(baseCreator()),
    resolveCreatorIntelligence(baseCreator({ unified_id: "dis:hit", ai_category: "Lifestyle" })),
  ]);
  assert.equal(pool[0]?.unifiedId, "dis:hit");

  // Empty requirements → perfect score (no constraints).
  const empty = matchCreatorToCampaign({}, resolveCreatorIntelligence(baseCreator()));
  assert.equal(empty.score, 100);
}

// --- coverage + shadow ------------------------------------------------------------

function testCoverageAndShadow(): void {
  const pool = [
    baseCreator({ ai_category: "Entertainment" }),
    baseCreator({ unified_id: "dis:2" }),
    baseCreator({
      unified_id: "dis:3",
      categories: ["Lifestyle"],
      browse_category_tags: ["Lifestyle"],
    }),
  ];

  const coverage = evaluateIntelligenceCoverage(
    pool.map((creator) => resolveCreatorIntelligence(creator))
  );
  assert.equal(coverage.total, 3);
  // Only the AI-scored creator resolves categories (provenance tags excluded).
  assert.equal(coverage.categories.resolved, 1);
  assert.equal(coverage.byPlatform["tiktok"]?.total, 3);

  // Shadow: legacy passes only the provenance-tagged creator (it never reads
  // ai_category); CI passes only the AI-scored one and RECOVERS it.
  const report = compareCategoryFiltering(pool, ["Lifestyle", "Entertainment"]);
  assert.equal(report.total, 3);
  assert.equal(report.legacyPass, 1);
  assert.equal(report.intelligencePass, 1);
  assert.equal(report.recoveredByIntelligence, 1);
  assert.equal(report.provenanceOnlyMatches, 1);
  assert.equal(report.unresolved, 2);

  assert.ok(
    creatorIntelligenceMatchesCategories(baseCreator({ ai_category: "entertainment" }), [
      "Entertainment",
    ])
  );
  assert.ok(!creatorIntelligenceMatchesCategories(baseCreator(), ["Entertainment"]));
}

function run(): void {
  testTaxonomy();
  testResolverIgnoresDiscoveryProvenance();
  testResolverPrecedence();
  testMatchingEngine();
  testCoverageAndShadow();
  console.log("creator-intelligence.test.ts: PASS");
}

run();
