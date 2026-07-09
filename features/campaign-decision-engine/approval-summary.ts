/**
 * Approval summary — logic only, no UI.
 */

import type {
  ApprovalSummary,
  CampaignDecisionContext,
  CampaignScenario,
  ClientCreatorEvaluation,
  StructuredRecommendation,
} from "./decision-types";

export function buildApprovalSummary(
  baseline: CampaignDecisionContext,
  scenarios: CampaignScenario[],
  recommendations: StructuredRecommendation[],
  clientEvaluations: ClientCreatorEvaluation[]
): ApprovalSummary {
  const original = scenarios.find((s) => s.name === "Original") ?? scenarios[0];
  const warnings: string[] = [];
  let highRisksCount = 0;

  for (const scenario of scenarios) {
    if (scenario.simulationResult.risk.level === "high") {
      highRisksCount += 1;
      warnings.push(`Scenario "${scenario.name}" has high risk level`);
    }
    if (scenario.simulationResult.risk.highRiskCount > baseline.risk.highRiskCount) {
      warnings.push(`Scenario "${scenario.name}" adds ${scenario.simulationResult.risk.highRiskCount - baseline.risk.highRiskCount} risk factor(s)`);
    }
  }

  const replaceRecommended = clientEvaluations.filter((e) => e.replaceRecommended);
  if (replaceRecommended.length > 0) {
    warnings.push(`${replaceRecommended.length} client creator(s) recommended for replacement`);
  }

  const budgetCuts = scenarios.filter(
    (s) => (s.changes.budgetChange?.percentChange ?? 0) <= -20
  );
  if (budgetCuts.some((s) => s.simulationResult.kpis.reach < baseline.kpis.reach * 0.75)) {
    warnings.push("Budget cut scenarios reduce reach below 75% of baseline");
  }

  const clientConstraintsSatisfied =
    replaceRecommended.length === 0 ||
    scenarios.some(
      (s) =>
        s.name === "Client Creators" &&
        s.thinkwayScore.total >= baseline.successProbability * 0.85
    );

  const bestScenario = scenarios.reduce((best, s) =>
    s.thinkwayScore.total > best.thinkwayScore.total ? s : best
  , original);

  const campaignHealth: ApprovalSummary["campaignHealth"] =
    highRisksCount >= 3
      ? "critical"
      : highRisksCount >= 1 || warnings.length >= 4
        ? "at_risk"
        : "healthy";

  const readyForApproval =
    campaignHealth !== "critical" &&
    original.thinkwayScore.total >= 60 &&
    (bestScenario.thinkwayScore.total >= original.thinkwayScore.total - 5);

  const details = [
    `Baseline Thinkway Score: ${original.thinkwayScore.total}`,
    `Best scenario: ${bestScenario.name} (score ${bestScenario.thinkwayScore.total})`,
    `Success probability: ${original.simulationResult.successProbability}%`,
    `Creators: ${baseline.creators.length}`,
    `Budget: ${baseline.budget.currency} ${baseline.budget.total.toLocaleString()}`,
  ];

  return {
    campaignHealth,
    warningsCount: warnings.length,
    recommendationsCount: recommendations.length,
    highRisksCount,
    clientConstraintsSatisfied,
    readyForApproval,
    details: [...details, ...warnings.slice(0, 5)],
  };
}
