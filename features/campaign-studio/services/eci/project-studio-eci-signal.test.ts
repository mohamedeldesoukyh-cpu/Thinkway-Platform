import assert from "node:assert/strict";
import test from "node:test";

import type { CreatorIntelligenceBundle } from "@/lib/enterprise-creator-intelligence";

import {
  formatStudioPresentationRecommendation,
  formatStudioProposalCreatorNarrative,
} from "./index";
import {
  formatStudioEciReason,
  projectStudioEciPlanningSignal,
  studioEciFitScoreRecord,
  buildStudioEciSignalMap,
} from "./project-studio-eci-signal";

function stubBundle(
  overrides?: Partial<CreatorIntelligenceBundle>
): CreatorIntelligenceBundle {
  return {
    influencerId: "creator-1",
    platform: "instagram",
    computedAt: new Date().toISOString(),
    historical: {} as CreatorIntelligenceBundle["historical"],
    commercial: {
      influencerId: "creator-1",
      platform: "instagram",
      currencyCode: "EGP",
      computedAt: new Date().toISOString(),
      metrics: [],
      commercialHealth: {
        level: "Healthy",
        explanation: "ok",
        dimensions: {
          pricing: "Healthy",
          efficiency: "Healthy",
          performance: "Healthy",
          commercialStability: "Healthy",
          commercialConfidence: "Healthy",
        },
      },
      investmentReadiness: {
        status: "Ready",
        explanation: "ready",
      },
      evidenceCoverage: { percent: 80, missingInputs: [], meaning: "good" },
      aiHints: {
        metricsAvailable: true,
        metricCount: 1,
        moneyMetricsReady: true,
        lowConfidenceKeys: [],
        recommendCommercialRefresh: false,
        commercialHealth: "Healthy",
        investmentReadiness: "Ready",
      },
      consumers: [],
    } as CreatorIntelligenceBundle["commercial"],
    categoryBrand: {} as CreatorIntelligenceBundle["categoryBrand"],
    performance: {} as CreatorIntelligenceBundle["performance"],
    audience: {} as CreatorIntelligenceBundle["audience"],
    investment: {
      influencerId: "creator-1",
      platform: "instagram",
      computedAt: new Date().toISOString(),
      overallScore: 82,
      recommendation: {
        recommendation: "Recommended",
        why: "Strong commercial efficiency and audience quality.",
        confidence: { percent: 74, reason: "coverage", basedOn: [] },
        score: 82,
        scoreMeaning: "Solid planning investment candidate",
        basedOnLayers: ["commercial", "audience"],
        explainability: {
          value: 82,
          meaning: "Investment score",
          reason: "Layered evidence",
          evidence: ["ER stable", "Category match"],
          confidence: 74,
          historicalTrend: "stable",
          businessContext: "Efficient CPM relative to category peers",
          source: {
            platform: "instagram",
            collectionMethod: "eci",
            refreshTime: null,
            confidence: 74,
          },
          lastUpdated: null,
          missingInputs: [],
        },
      },
      dimensions: [
        {
          key: "commercial_efficiency",
          label: "Commercial efficiency",
          score: 88,
          confidence: 70,
          weight: 0.12,
          weightedContribution: 10,
          explanation: "Efficient",
          supportingEvidence: [],
          historicalTrend: "stable",
          source: {
            platform: "instagram",
            collectionMethod: "eci",
            refreshTime: null,
            confidence: 70,
          },
          lastUpdated: null,
          missingInputs: [],
          explainability: {
            value: 88,
            meaning: "",
            reason: "",
            evidence: [],
            confidence: 70,
            historicalTrend: "",
            businessContext: "",
            source: {
              platform: "instagram",
              collectionMethod: "eci",
              refreshTime: null,
              confidence: 70,
            },
            lastUpdated: null,
            missingInputs: [],
          },
        },
      ],
      risks: [
        {
          key: "r1",
          label: "Pricing volatility",
          severity: "Low",
          explanation: "Rates vary by campaign type",
          suggestedAction: "Lock fee early",
          evidence: [],
        },
      ],
      opportunities: [
        {
          key: "o1",
          label: "Category authority",
          explanation: "Strong beauty affinity",
          evidence: [],
          businessContext: "Use as hero creator",
        },
      ],
      businessReadiness: {
        planningWorkspace: "Ready for Studio planning",
        clientWorkspace: "Ready",
        campaignWorkspace: "Ready",
        reporting: "Ready",
        enterpriseAnalytics: "Ready",
        aiCopilot: "Hints only",
        mobile: "Ready",
        overall: "Recommended",
        commercialAudienceReady: true,
        commercialReady: true,
        performanceReliable: true,
        missingInputs: [],
      },
      evidenceCoverage: { percent: 78, missingInputs: [], meaning: "good" },
      source: {
        platform: "instagram",
        collectionMethod: "eci",
        refreshTime: null,
        confidence: 74,
      },
      aiHints: {
        available: true,
        recommendation: "Recommended",
        score: 82,
        confidencePercent: 74,
        topStrengths: [],
        topRisks: [],
        scoreDrivers: [],
        recommendRefresh: false,
        explainWhyRecommended: "",
        explainConfidenceDrivers: "",
        explainScoreMovement: "",
        suggestBusinessActions: [],
      },
      consumers: [],
      layerCoverage: {
        historical: true,
        commercial: true,
        categoryBrand: true,
        performance: true,
        audience: true,
      },
    } as CreatorIntelligenceBundle["investment"],
    consumers: [],
    ...overrides,
  };
}

test("projectStudioEciPlanningSignal maps investment to explainable Studio signal", () => {
  const signal = projectStudioEciPlanningSignal(stubBundle());
  assert.equal(signal.investmentScore, 82);
  assert.equal(signal.recommendation, "Recommended");
  assert.match(signal.why, /commercial efficiency/i);
  assert.match(signal.commercialJustification, /Efficient CPM|Commercial health/i);
  assert.ok(signal.evidence.length > 0);
  assert.ok(signal.executiveSummary.includes("Recommended"));
  assert.ok(formatStudioEciReason(signal).includes("Evidence:"));
  assert.ok(signal.decision.what.includes("Recommended"));
  assert.ok(signal.layers.investment.includes("Recommended"));
  assert.ok(signal.whyNot.length > 0);
  assert.match(
    formatStudioProposalCreatorNarrative(signal, "Creator One"),
    /Recommended: Creator One/i
  );
  assert.match(formatStudioPresentationRecommendation(signal), /Recommendation:/i);
  assert.match(formatStudioPresentationRecommendation(signal), /Planning confidence:/i);
});

test("studioEciFitScoreRecord exposes bare and inf keys", () => {
  const map = buildStudioEciSignalMap([stubBundle()]);
  const record = studioEciFitScoreRecord(map);
  assert.equal(record["creator-1"], 82);
  assert.equal(record["inf:creator-1"], 82);
});
