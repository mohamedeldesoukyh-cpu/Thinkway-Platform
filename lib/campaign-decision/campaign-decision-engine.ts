import { CAMPAIGN_DECISION_ENGINE_VERSION } from "./config";
import { buildApprovalSummary, extractOptimizationStrengths } from "./approval-summary";
import { computeDecisionScore } from "./decision-score";
import { computeKpiProbabilities, minKpiProbability } from "./kpi-probability";
import { assessLaunchReadiness } from "./readiness";
import { buildDecisionRecommendations } from "./recommendations";
import { buildRiskMatrix, detectCampaignRisks } from "./risks";
import type { CampaignDecisionInput, CampaignDecisionReport } from "./types";

/**
 * Single entry point for campaign decision intelligence.
 * Consumes Forecast + Optimization outputs only — never recalculates upstream engines.
 */
export function evaluateCampaignDecision(input: CampaignDecisionInput): CampaignDecisionReport {
  const { forecast, optimization, configuration } = input;
  const computedAt = new Date().toISOString();

  const risks = detectCampaignRisks({ forecast, optimization, configuration });
  const riskMatrix = buildRiskMatrix(risks);
  const kpiProbabilities = computeKpiProbabilities({ forecast, optimization, configuration, risks });
  const minKpi = minKpiProbability(kpiProbabilities);
  const readinessResult = assessLaunchReadiness({
    forecast,
    optimization,
    configuration,
    risks,
    minKpiProbability: minKpi,
  });
  const decisionScore = computeDecisionScore({ forecast, optimization, configuration, risks });
  const recommendations = buildDecisionRecommendations({
    readiness: readinessResult.readiness,
    risks,
    optimization,
  });
  const approvalSummary = buildApprovalSummary({
    readiness: readinessResult.readiness,
    readinessLabel: readinessResult.label,
    decisionScore,
    risks,
    recommendations,
    kpiProbabilities,
    optimizationStrengths: extractOptimizationStrengths(
      optimization.healthScore.overall,
      forecast.confidenceScore.score
    ),
  });

  const explainability = [
    `Decision evaluation on forecast ${forecast.confidenceScore.score}/100 confidence and optimization health ${optimization.healthScore.overall}/100.`,
    `Launch readiness: ${readinessResult.label} — ${readinessResult.reasoning.join(" ")}`,
    `Decision score ${decisionScore.overall}/100 with ${risks.length} risks (${risks.filter((r) => r.severity === "high" || r.severity === "critical").length} high/critical).`,
    `${recommendations.length} business recommendations prioritized for approval workflow.`,
    ...decisionScore.explainability.slice(0, 4),
  ];

  return {
    engineVersion: CAMPAIGN_DECISION_ENGINE_VERSION,
    readiness: readinessResult.readiness,
    readinessLabel: readinessResult.label,
    decisionScore,
    risks,
    riskMatrix,
    kpiProbabilities,
    recommendations,
    approvalSummary,
    diagnostics: {
      forecastEngineVersion: forecast.assumptions.calculationMethod,
      optimizationEngineVersion: optimization.engineVersion,
      creatorCount: forecast.creatorForecasts.length,
      highRiskCount: risks.filter((r) => r.severity === "high" || r.severity === "critical").length,
      mediumRiskCount: risks.filter((r) => r.severity === "medium").length,
      operationalGaps:
        (configuration?.operational?.planMandatoryMissing?.length ?? 0) +
        (configuration?.operational?.operationalMandatoryMissing?.length ?? 0),
    },
    explainability,
    computedAt,
  };
}

export function toCampaignDecisionSnapshot(report: CampaignDecisionReport): CampaignDecisionReport {
  return report;
}
