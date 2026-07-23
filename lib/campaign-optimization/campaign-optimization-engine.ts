import { CAMPAIGN_OPTIMIZATION_ENGINE_VERSION } from "./config";
import { runAllAnalyzers } from "./analyzers";
import {
  computeCampaignHealthScore,
  computeOptimizationScore,
} from "./health-score";
import { countOpportunitiesByImpact, findingsToOpportunities } from "./opportunities";
import { buildRecommendations } from "./recommendations";
import { buildScenarioComparisons } from "./scenarios";
import type {
  CampaignOptimizationInput,
  CampaignOptimizationReport,
  OptimizationCategory,
} from "./types";

/**
 * Single entry point for campaign optimization analysis.
 * Consumes Campaign Forecast Engine output only — never recalculates forecast metrics.
 */
export function optimizeCampaign(input: CampaignOptimizationInput): CampaignOptimizationReport {
  const { forecast, context } = input;
  const computedAt = new Date().toISOString();

  const findings = runAllAnalyzers(forecast, context);
  const opportunities = findingsToOpportunities(findings);
  const recommendations = buildRecommendations(findings, opportunities);
  const healthScore = computeCampaignHealthScore(forecast, context);
  const impactCounts = countOpportunitiesByImpact(opportunities);
  const optimizationScore = computeOptimizationScore(healthScore.overall, opportunities);
  const scenarioComparisons = buildScenarioComparisons(forecast, opportunities);

  const categoriesAnalyzed: OptimizationCategory[] = [
    "reach",
    "budget",
    "creator_mix",
    "platform",
    "deliverable",
    "audience",
  ];

  const overlapRatio =
    forecast.grossReach > 0 ? forecast.overlapDeduction / forecast.grossReach : null;
  const reachEfficiency =
    forecast.audienceSize > 0 ? forecast.estimatedReach / forecast.audienceSize : null;

  const explainability = [
    `Optimization analysis on forecast confidence ${forecast.confidenceScore.score}/100 (${forecast.confidenceScore.label}).`,
    `Campaign health ${healthScore.overall}/100 (${healthScore.label}); projected optimized score ${optimizationScore}/100.`,
    `${opportunities.length} opportunities identified (${impactCounts.high} high, ${impactCounts.medium} medium, ${impactCounts.low} low impact).`,
    `${recommendations.length} actionable recommendations generated with forecast-metric traceability.`,
    ...healthScore.explainability.slice(0, 3),
  ];

  return {
    engineVersion: CAMPAIGN_OPTIMIZATION_ENGINE_VERSION,
    healthScore,
    optimizationScore,
    opportunities,
    recommendations,
    scenarioComparisons,
    diagnostics: {
      creatorCount: forecast.creatorForecasts.length,
      categoriesAnalyzed,
      forecastConfidence: forecast.confidenceScore.score,
      limitedAudienceSignals: !context?.audienceTargets,
      overlapRatio,
      reachEfficiency,
    },
    explainability,
    computedAt,
  };
}

export function toCampaignOptimizationSnapshot(
  report: CampaignOptimizationReport
): CampaignOptimizationReport {
  return report;
}
