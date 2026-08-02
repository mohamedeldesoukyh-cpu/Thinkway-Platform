import {
  buildInvestmentDimensions,
  type InvestmentLayerBundle,
} from "@/lib/enterprise-creator-intelligence/investment/dimensions";
import {
  buildRecommendationInsight,
  computeWeightedOverallScore,
} from "@/lib/enterprise-creator-intelligence/investment/recommend";
import {
  buildInvestmentOpportunities,
  buildInvestmentRisks,
} from "@/lib/enterprise-creator-intelligence/investment/risks-opportunities";
import type {
  CreatorInvestmentAiHints,
  CreatorInvestmentIntelligence,
  InvestmentBusinessReadiness,
  InvestmentSource,
} from "@/lib/enterprise-creator-intelligence/investment/types";
import { INVESTMENT_CONSUMERS } from "@/lib/enterprise-creator-intelligence/investment/types";
import { investmentEvidenceCoverage } from "@/lib/enterprise-creator-intelligence/shared/evidence-coverage";

export type { InvestmentLayerBundle };

export type CreatorInvestmentFacts = InvestmentLayerBundle;

function buildBusinessReadiness(
  intelligence: Omit<CreatorInvestmentIntelligence, "businessReadiness" | "aiHints" | "consumers">
): InvestmentBusinessReadiness {
  const rec = intelligence.recommendation.recommendation;
  const commercialReady =
    intelligence.layerCoverage.commercial &&
    !intelligence.risks.some((r) => r.key === "limited_commercial_data");
  const commercialAudienceReady = !intelligence.dimensions
    .find((d) => d.key === "audience_quality")
    ?.missingInputs.includes("audience_intelligence");
  const performanceReliable =
    (intelligence.dimensions.find((d) => d.key === "performance_reliability")
      ?.score ?? 0) >= 60;

  const summaryFor = (surface: string) =>
    `${rec} — reuse Creator Investment Intelligence for ${surface} (score ${intelligence.overallScore ?? "n/a"}, confidence ${intelligence.recommendation.confidence.percent ?? "n/a"}%).`;

  return {
    planningWorkspace: summaryFor("Planning Workspace"),
    clientWorkspace: summaryFor("Client Workspace"),
    campaignWorkspace: summaryFor("Campaign Workspace"),
    reporting: summaryFor("Reporting"),
    enterpriseAnalytics: summaryFor("Enterprise Analytics"),
    aiCopilot: summaryFor("AI Copilot"),
    mobile: summaryFor("Mobile"),
    overall: rec,
    commercialAudienceReady: Boolean(commercialAudienceReady),
    commercialReady,
    performanceReliable,
    missingInputs: [
      ...new Set(intelligence.dimensions.flatMap((d) => d.missingInputs)),
    ],
  };
}

function buildAiHints(
  intelligence: Omit<CreatorInvestmentIntelligence, "aiHints" | "consumers">
): CreatorInvestmentAiHints {
  const ranked = [...intelligence.dimensions]
    .filter((d) => d.weightedContribution != null)
    .sort(
      (a, b) => (b.weightedContribution ?? 0) - (a.weightedContribution ?? 0)
    );

  const topStrengths = ranked
    .filter((d) => (d.score ?? 0) >= 75)
    .slice(0, 4)
    .map((d) => d.label);

  const topRisks = intelligence.risks.slice(0, 4).map((r) => r.label);

  const scoreDrivers = ranked.slice(0, 5).map((d) => ({
    dimension: d.label,
    contribution: d.weightedContribution,
  }));

  const suggestBusinessActions = [
    ...intelligence.risks.slice(0, 3).map((r) => r.suggestedAction),
    ...intelligence.opportunities
      .slice(0, 2)
      .map((o) => `Leverage opportunity: ${o.label}`),
  ];

  return {
    available: intelligence.overallScore != null,
    recommendation: intelligence.recommendation.recommendation,
    score: intelligence.overallScore,
    confidencePercent: intelligence.recommendation.confidence.percent,
    topStrengths,
    topRisks,
    scoreDrivers,
    recommendRefresh:
      intelligence.recommendation.recommendation === "Insufficient Data" ||
      intelligence.risks.some((r) => r.key === "missing_data"),
    explainWhyRecommended: intelligence.recommendation.why,
    explainConfidenceDrivers: intelligence.recommendation.confidence.reason,
    explainScoreMovement:
      "Compare append-only creator_intelligence_investment_history captures for dimension contribution deltas.",
    suggestBusinessActions,
  };
}

/**
 * Pure Creator Investment Intelligence — consumes Sprint 1–5 outputs only.
 */
export function computeCreatorInvestmentIntelligence(
  facts: CreatorInvestmentFacts
): CreatorInvestmentIntelligence {
  const computedAt = facts.computedAt || new Date().toISOString();
  const platform = facts.platform;

  const layers: InvestmentLayerBundle = {
    ...facts,
    computedAt,
  };

  const dimensions = buildInvestmentDimensions(layers);
  const overallScore = computeWeightedOverallScore(dimensions);
  const risks = buildInvestmentRisks(layers, dimensions);
  const opportunities = buildInvestmentOpportunities(layers, dimensions);

  const layerCoverage = {
    historical: (facts.historicalMonthly?.length ?? 0) > 0,
    commercial: facts.commercial != null,
    categoryBrand: facts.categoryBrand != null,
    performance: facts.performance != null,
    audience: facts.audience != null,
  };

  const layerLabelsPresent = [
    layerCoverage.historical ? "Historical Campaigns / Monthly History" : null,
    layerCoverage.commercial ? "Commercial Data" : null,
    layerCoverage.audience ? "Audience Intelligence" : null,
    layerCoverage.performance ? "Performance History" : null,
    layerCoverage.categoryBrand ? "Category Intelligence" : null,
    layerCoverage.commercial ? "Commercial Metrics" : null,
  ].filter((v): v is string => v != null);

  const source: InvestmentSource = {
    platform,
    collectionMethod:
      "Composition of Sprint 1–5 Enterprise Creator Intelligence layers (no duplicated engines)",
    refreshTime: computedAt,
    confidence: null,
  };

  const evidenceCoverage = investmentEvidenceCoverage({
    layerFlags: layerCoverage,
    scoredDimensionCount: dimensions.filter((d) => d.score != null).length,
    totalDimensions: dimensions.length,
  });

  const recommendation = buildRecommendationInsight({
    overallScore,
    dimensions,
    risks,
    layerLabelsPresent: [...new Set(layerLabelsPresent)],
    source,
    computedAt,
    evidenceCoveragePercent: evidenceCoverage.percent,
  });

  source.confidence = recommendation.confidence.percent;

  const base = {
    influencerId: facts.influencerId,
    platform,
    computedAt,
    overallScore,
    recommendation,
    dimensions,
    risks,
    opportunities,
    evidenceCoverage,
    source,
    layerCoverage,
  };

  const businessReadiness = buildBusinessReadiness(base);
  const withReadiness = { ...base, businessReadiness };
  const aiHints = buildAiHints(withReadiness);

  return {
    ...withReadiness,
    aiHints,
    consumers: INVESTMENT_CONSUMERS,
  };
}
