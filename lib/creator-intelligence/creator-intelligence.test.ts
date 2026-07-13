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

// --- phases A–C: creator type, brand safety, audience intelligence -------------

function testCreatorTypeResolution(): void {
  // Declared role wins over follower-derived tier.
  const declared = resolveCreatorIntelligence(baseCreator({ role: "Macro" }));
  assert.equal(declared.creatorType.value, "Macro");
  assert.equal(declared.creatorType.source, "declared");

  // 250k followers → Mid tier from platform metrics.
  const derived = resolveCreatorIntelligence(baseCreator());
  assert.equal(derived.creatorType.value, "Mid");
  assert.equal(derived.creatorType.source, "platform_metrics");

  const unknown = resolveCreatorIntelligence(baseCreator({ platforms: [] }));
  assert.equal(unknown.creatorType.value, null);
  assert.equal(unknown.creatorType.source, "unresolved");
}

function testBrandSafetyLadder(): void {
  const lowRisk = resolveCreatorIntelligence(
    baseCreator({ is_platform_verified: true, authenticity_score: 82 })
  );
  assert.equal(lowRisk.brandSafety.level.value, "low_risk");

  const weak = resolveCreatorIntelligence(baseCreator({ authenticity_score: 25 }));
  assert.equal(weak.brandSafety.level.value, "moderate_risk");
  assert.ok(weak.brandSafety.signals.includes("weak_authenticity"));

  // No signals → unknown, never safe.
  const none = resolveCreatorIntelligence(baseCreator());
  assert.equal(none.brandSafety.level.value, "unknown");
}

const demographics = {
  age: {
    "13_17": 5,
    "18_24": 46,
    "25_34": 30,
    "35_44": 12,
    "45_54": 5,
    "55_plus": 2,
  },
  gender: { male: 38, female: 60, unknown: 2 },
  topCountries: [
    { code: "EG", percent: 62 },
    { name: "Saudi Arabia", percent: 15 },
  ],
  topCities: null,
  source: "modash",
} as NonNullable<UnifiedCreatorResult["audience_demographics"]>;

function testAudienceIntelligence(): void {
  const ci = resolveCreatorIntelligence(baseCreator({ audience_demographics: demographics }));
  assert.deepEqual(ci.audience.countries.value, ["EG", "SA"]);
  assert.equal(ci.audience.countries.source, "platform_metrics");
  assert.equal(ci.audience.dominantAgeBucket.value, "18_24");
  assert.deepEqual(ci.audience.genderSplit.value, { male: 38, female: 60 });
  assert.equal(ci.audience.hasDemographics, true);
  // Audience languages: honest gap — unresolved until enrichment exists.
  assert.equal(ci.audience.languages.source, "unresolved");

  // Without demographics: creator country proxy, unresolved age/gender.
  const proxy = resolveCreatorIntelligence(baseCreator());
  assert.deepEqual(proxy.audience.countries.value, ["EG"]);
  assert.equal(proxy.audience.countries.source, "declared");
  assert.equal(proxy.audience.dominantAgeBucket.value, null);
  assert.equal(proxy.audience.genderSplit.value, null);
}

// --- phase D: new matching dimensions --------------------------------------------

function testMatchingDimensionsPhaseD(): void {
  const requirements = campaignRequirementsFromFacts(facts, {
    categories: ["Entertainment"],
    creatorTypes: ["mid", "Macro"],
  });
  assert.deepEqual(requirements.creatorTypes, ["Mid", "Macro"]);

  const fit = matchCreatorToCampaign(
    { ...requirements, audienceAgeBuckets: ["18_24"], audienceGender: "female" },
    resolveCreatorIntelligence(
      baseCreator({ ai_category: "Entertainment", audience_demographics: demographics })
    )
  );
  assert.equal(fit.eligible, true);
  assert.equal(fit.score, 100);
  for (const dimension of ["creator_type", "audience_age", "audience_gender"] as const) {
    assert.ok(
      fit.breakdown.some((b) => b.dimension === dimension && b.evaluation === "match"),
      `expected ${dimension} match`
    );
  }

  // Male-target campaign vs 38% male audience → hard mismatch.
  const genderMiss = matchCreatorToCampaign(
    { audienceGender: "male" },
    resolveCreatorIntelligence(baseCreator({ audience_demographics: demographics }))
  );
  assert.equal(genderMiss.eligible, false);

  // Nano-only mix vs Mid creator → hard mismatch; unknown tier discounts only.
  const tierMiss = matchCreatorToCampaign(
    { creatorTypes: ["Nano"] },
    resolveCreatorIntelligence(baseCreator())
  );
  assert.equal(tierMiss.eligible, false);
  const tierUnknown = matchCreatorToCampaign(
    { creatorTypes: ["Nano"] },
    resolveCreatorIntelligence(baseCreator({ platforms: [] }))
  );
  assert.equal(tierUnknown.eligible, true);

  // Audience-country intelligence feeds the country dimension (SA top country).
  const saMatch = matchCreatorToCampaign(
    { country: "SA" },
    resolveCreatorIntelligence(baseCreator({ audience_demographics: demographics }))
  );
  assert.ok(saMatch.breakdown.some((b) => b.dimension === "country" && b.evaluation === "match"));
}

// --- phase E: flag-gated consumers -------------------------------------------------

async function testRankingConsumerOnMode(): Promise<void> {
  const { categoryMatchScore } = await import("@/lib/creators/unified-ranking");
  const intent = { categories: ["Entertainment"] };
  const aiScored = baseCreator({ ai_category: "Entertainment" });
  const provenanceOnly = baseCreator({
    categories: ["Entertainment"],
    browse_category_tags: ["Entertainment"],
  });

  const prev = process.env.CREATOR_INTELLIGENCE_MODE;
  try {
    process.env.CREATOR_INTELLIGENCE_MODE = "off";
    // Legacy: provenance tags score a full hit.
    assert.equal(categoryMatchScore(provenanceOnly, intent), 1);

    process.env.CREATOR_INTELLIGENCE_MODE = "on";
    // CI: resolved intelligence wins; provenance-only scores as unresolved (0.4).
    assert.equal(categoryMatchScore(aiScored, intent), 1);
    assert.equal(categoryMatchScore(provenanceOnly, intent), 0.4);
  } finally {
    if (prev === undefined) delete process.env.CREATOR_INTELLIGENCE_MODE;
    else process.env.CREATOR_INTELLIGENCE_MODE = prev;
  }
}

// --- phase H: SQL projection row mapping ------------------------------------------

async function testProjectionRowMapping(): Promise<void> {
  const { creatorIntelligenceProjectionRow } = await import("./projection");
  const row = creatorIntelligenceProjectionRow(
    resolveCreatorIntelligence(
      baseCreator({
        ai_category: "Entertainment",
        ai_niche: "comedy",
        audience_demographics: demographics,
        role: "Macro",
      })
    )
  );
  assert.equal(row.unified_id, "dis:test-1");
  assert.deepEqual(row.categories, ["Entertainment"]);
  assert.equal(row.category_source, "ai_enrichment");
  assert.equal(row.niche, "comedy");
  assert.equal(row.creator_tier, "Macro");
  assert.deepEqual(row.audience_countries, ["EG", "SA"]);
  assert.equal(row.audience_age_bucket, "18_24");
  assert.equal(row.audience_gender_female, 60);
  assert.equal(row.brand_safety_level, "unknown");
  assert.equal(row.max_followers, 250_000);
  assert.ok(row.resolved_at);
}

async function run(): Promise<void> {
  testTaxonomy();
  testResolverIgnoresDiscoveryProvenance();
  testResolverPrecedence();
  testMatchingEngine();
  testCoverageAndShadow();
  testCreatorTypeResolution();
  testBrandSafetyLadder();
  testAudienceIntelligence();
  testMatchingDimensionsPhaseD();
  await testRankingConsumerOnMode();
  await testProjectionRowMapping();
  console.log("creator-intelligence.test.ts: PASS");
}

void run();
