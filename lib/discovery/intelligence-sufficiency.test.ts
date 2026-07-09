import assert from "node:assert/strict";

import {
  evaluateIntelligenceSufficiency,
  getIntelligenceSufficiencyConfig,
} from "./intelligence-sufficiency";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function mockCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:test",
    source_type: "internal",
    influencer_id: "test-id",
    discovered_profile_id: null,
    document_number: "TW-TEST",
    display_name: "Test Creator",
    status: "active",
    country_code: "AE",
    estimated_country: "AE",
    city: null,
    categories: ["beauty"],
    language_codes: ["en"],
    profile_image_url: null,
    bio: "Beauty creator in Dubai",
    metrics: {
      followers: { value: 50_000, confidence: "estimated" },
      engagement_rate: { value: 3.5, confidence: "estimated" },
      avg_likes: { value: 1000, confidence: "estimated" },
      avg_comments: { value: 50, confidence: "estimated" },
      avg_views: { value: null, confidence: "inferred" },
      posting_frequency_per_week: { value: 2, confidence: "inferred" },
    },
    ai_category: "Beauty",
    ai_niche: "Skincare",
    authenticity_score: 75,
    thinkway_score: 55,
    source_confidence: 0.8,
    brand_fit_score: 62,
    is_platform_verified: false,
    platforms: [],
    dna_completeness: 40,
    enrichment_status: "enriched",
    last_enriched_at: new Date().toISOString(),
    ...overrides,
  };
}

const config = {
  ...getIntelligenceSufficiencyConfig(),
  minCreatorCount: 2,
  minAvgDnaCompleteness: 35,
  minBrandFitRatio: 0.5,
  minAudienceRatio: 0.5,
  minAiCategoryRatio: 0.5,
  minBioRatio: 0.5,
  minFreshnessRatio: 0.5,
  scoreThreshold: 70,
};

const sufficient = evaluateIntelligenceSufficiency(
  {
    creators: [mockCreator(), mockCreator({ unified_id: "inf:test-2" })],
    total: 2,
  },
  {},
  config
);

assert.equal(sufficient.sufficient, true);
assert.equal(sufficient.intelligenceGaps.length, 0);
assert.equal(sufficient.acquisitionRequired, false);

const insufficient = evaluateIntelligenceSufficiency(
  {
    creators: [
      mockCreator({
        brand_fit_score: null,
        ai_category: null,
        ai_niche: null,
        bio: null,
        dna_completeness: 10,
        last_enriched_at: null,
        enrichment_status: "never",
      }),
    ],
    total: 1,
  },
  {},
  config
);

assert.equal(insufficient.sufficient, false);
assert.ok(insufficient.intelligenceGaps.includes("low_creator_count"));
assert.ok(insufficient.intelligenceGaps.includes("missing_brand_fit"));
assert.ok(insufficient.intelligenceGaps.includes("missing_ai_category"));
assert.ok(insufficient.intelligenceGaps.includes("missing_bio"));
assert.equal(insufficient.acquisitionRequired, true);
assert.ok(insufficient.acquisitionHints.prioritizeIntelligenceEnrichment);

const partialWithGaps = evaluateIntelligenceSufficiency(
  {
    creators: [
      mockCreator(),
      mockCreator({
        unified_id: "inf:test-2",
        brand_fit_score: null,
        bio: null,
        dna_completeness: 20,
      }),
    ],
    total: 2,
  },
  {},
  config
);

assert.equal(partialWithGaps.sufficiencyLevel, "partial");
assert.ok(partialWithGaps.intelligenceGaps.length > 0);
assert.equal(partialWithGaps.sufficient, true);
assert.equal(partialWithGaps.acquisitionRequired, false);

console.log("lib/discovery/intelligence-sufficiency.test.ts — all tests passed");
