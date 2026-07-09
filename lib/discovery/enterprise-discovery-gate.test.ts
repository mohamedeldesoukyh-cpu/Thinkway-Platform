import assert from "node:assert/strict";

import { evaluateEnterpriseDiscoveryBackfillNeed } from "./enterprise-discovery-gate";

// L'Oréal runtime: 0 creators, insufficient coverage, threshold 0 — must still backfill.
const zeroCreators = evaluateEnterpriseDiscoveryBackfillNeed({
  creatorCount: 0,
  minimumCreatorCount: 10,
  coverageScore: 62,
  coverageThreshold: 0,
  useIntelligenceGate: false,
});

assert.equal(zeroCreators.needsBackfill, true);
assert.equal(zeroCreators.meetsThreshold, false);
assert.equal(zeroCreators.reason, "low_creator_count");

const sufficientCoverage = evaluateEnterpriseDiscoveryBackfillNeed({
  creatorCount: 25,
  minimumCreatorCount: 10,
  coverageScore: 85,
  coverageThreshold: 80,
  useIntelligenceGate: false,
});

assert.equal(sufficientCoverage.needsBackfill, false);
assert.equal(sufficientCoverage.meetsThreshold, true);

const lowCoverageScore = evaluateEnterpriseDiscoveryBackfillNeed({
  creatorCount: 25,
  minimumCreatorCount: 10,
  coverageScore: 62,
  coverageThreshold: 80,
  useIntelligenceGate: false,
});

assert.equal(lowCoverageScore.needsBackfill, true);
assert.equal(lowCoverageScore.reason, "coverage_below_threshold");

const intelligenceInsufficient = evaluateEnterpriseDiscoveryBackfillNeed({
  creatorCount: 12,
  minimumCreatorCount: 10,
  coverageScore: 90,
  coverageThreshold: 80,
  useIntelligenceGate: true,
  intelligence: {
    sufficient: false,
    sufficiencyScore: 55,
    sufficiencyLevel: "insufficient",
    intelligenceGaps: ["missing_brand_fit"],
    gapReasons: [],
    breakdown: {
      matchingCreatorCount: 12,
      averageDnaCompleteness: 20,
      brandFitAvailabilityRatio: 0.1,
      audienceAvailabilityRatio: 0.8,
      aiCategoryCoverageRatio: 0.7,
      bioAvailabilityRatio: 0.6,
      freshnessRatio: 0.5,
    },
    coverage: {
      coverageScore: 90,
      coverageLevel: "good",
      missingReasons: [],
      breakdown: {
        count: 12,
        countryMatchRatio: 1,
        categoryMatchRatio: 1,
        platformMatchRatio: 1,
        audienceMatchRatio: null,
        budgetCompatibleRatio: null,
        dnaCompletenessRatio: 0.5,
        medianThinkwayScore: 50,
        searchConfidence: null,
      },
    },
    acquisitionRequired: true,
    acquisitionHints: {
      prioritizeIntelligenceEnrichment: true,
      broadenCreatorDiscovery: false,
      refreshStaleProfiles: false,
    },
  },
});

assert.equal(intelligenceInsufficient.needsBackfill, true);
assert.equal(intelligenceInsufficient.reason, "intelligence_insufficient");

const intelligencePartial = evaluateEnterpriseDiscoveryBackfillNeed({
  creatorCount: 15,
  minimumCreatorCount: 10,
  coverageScore: 55,
  coverageThreshold: 80,
  useIntelligenceGate: true,
  intelligence: {
    sufficient: true,
    sufficiencyScore: 62,
    sufficiencyLevel: "partial",
    intelligenceGaps: ["missing_brand_fit"],
    gapReasons: ["Brand fit gap"],
    breakdown: {
      matchingCreatorCount: 15,
      averageDnaCompleteness: 40,
      brandFitAvailabilityRatio: 0.4,
      audienceAvailabilityRatio: 0.8,
      aiCategoryCoverageRatio: 0.7,
      bioAvailabilityRatio: 0.6,
      freshnessRatio: 0.5,
    },
    coverage: {
      coverageScore: 55,
      coverageLevel: "partial",
      missingReasons: [],
      breakdown: {
        count: 15,
        countryMatchRatio: 1,
        categoryMatchRatio: 1,
        platformMatchRatio: 1,
        audienceMatchRatio: null,
        budgetCompatibleRatio: null,
        dnaCompletenessRatio: 0.5,
        medianThinkwayScore: 50,
        searchConfidence: null,
      },
    },
    acquisitionRequired: false,
    acquisitionHints: {
      prioritizeIntelligenceEnrichment: true,
      broadenCreatorDiscovery: false,
      refreshStaleProfiles: false,
    },
  },
});

assert.equal(intelligencePartial.needsBackfill, false);
assert.equal(intelligencePartial.reason, "sufficient");

console.log("lib/discovery/enterprise-discovery-gate.test.ts — all tests passed");
