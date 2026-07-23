import type { CampaignForecast } from "@/lib/campaign-forecast";
import type { CampaignOptimizationReport } from "@/lib/campaign-optimization";

import { DECISION_SCORE_WEIGHTS } from "./config";
import type {
  CampaignConfiguration,
  CampaignDecisionScore,
  CampaignRisk,
  DecisionScoreDeduction,
  DecisionScoreDimension,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function label(score: number): CampaignDecisionScore["label"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

function buildDimension(
  key: keyof typeof DECISION_SCORE_WEIGHTS,
  labelText: string,
  score: number,
  deductions: DecisionScoreDeduction[]
): DecisionScoreDimension {
  const weight = DECISION_SCORE_WEIGHTS[key];
  return {
    key,
    label: labelText,
    score: clamp(score),
    weight,
    weightedContribution: clamp((clamp(score) * weight) / 100),
    deductions,
  };
}

export function computeDecisionScore(input: {
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
  configuration?: CampaignConfiguration;
  risks: CampaignRisk[];
}): CampaignDecisionScore {
  const dimensions: DecisionScoreDimension[] = [];
  const explainability: string[] = [];

  const confidenceScore = input.forecast.confidenceScore.score;
  const confidenceDeductions: DecisionScoreDeduction[] = [];
  if (confidenceScore < 70) {
    confidenceDeductions.push({
      factor: "forecast_confidence",
      points: 70 - confidenceScore,
      reason: `Forecast confidence ${confidenceScore}/100 below launch threshold.`,
    });
  }
  dimensions.push(
    buildDimension("forecastConfidence", "Forecast Confidence", confidenceScore, confidenceDeductions)
  );

  const optimizationScore = input.optimization.optimizationScore;
  dimensions.push(
    buildDimension("optimizationQuality", "Optimization Quality", optimizationScore, [])
  );

  const highRisks = input.risks.filter((r) => r.severity === "high" || r.severity === "critical").length;
  const mediumRisks = input.risks.filter((r) => r.severity === "medium").length;
  const riskDeductions: DecisionScoreDeduction[] = [];
  let riskScore = clamp(100 - highRisks * 18 - mediumRisks * 8);
  if (highRisks > 0) {
    riskDeductions.push({
      factor: "high_risks",
      points: highRisks * 18,
      reason: `${highRisks} high/critical risk(s) detected.`,
    });
  }
  dimensions.push(buildDimension("riskLevel", "Risk Level", riskScore, riskDeductions));

  const budgetHealth = input.optimization.healthScore.dimensions.find(
    (d) => d.key === "budgetEfficiency"
  );
  dimensions.push(
    buildDimension(
      "budgetEfficiency",
      "Budget Efficiency",
      budgetHealth?.score ?? 65,
      budgetHealth?.deductions ?? []
    )
  );

  const diversityHealth = input.optimization.healthScore.dimensions.find(
    (d) => d.key === "creatorDiversity"
  );
  dimensions.push(
    buildDimension(
      "creatorQuality",
      "Creator Quality",
      diversityHealth?.score ?? 60,
      diversityHealth?.deductions ?? []
    )
  );

  const audienceHealth = input.optimization.healthScore.dimensions.find(
    (d) => d.key === "audienceQuality"
  );
  dimensions.push(
    buildDimension(
      "audienceQuality",
      "Audience Quality",
      audienceHealth?.score ?? 60,
      audienceHealth?.deductions ?? []
    )
  );

  const operational = input.configuration?.operational;
  const gapCount =
    (operational?.planMandatoryMissing?.length ?? 0) +
    (operational?.operationalMandatoryMissing?.length ?? 0) +
    (operational?.deliverablesDefined === false ? 2 : 0) +
    (operational?.timelineDefined === false ? 1 : 0);
  const operationalDeductions: DecisionScoreDeduction[] = [];
  let operationalScore = clamp(100 - gapCount * 12);
  if (gapCount > 0) {
    operationalDeductions.push({
      factor: "operational_gaps",
      points: gapCount * 12,
      reason: `${gapCount} operational/plan gap(s) before launch.`,
    });
  }
  dimensions.push(
    buildDimension("operationalCompleteness", "Operational Completeness", operationalScore, operationalDeductions)
  );

  const overall = clamp(dimensions.reduce((sum, d) => sum + d.weightedContribution, 0));
  explainability.push(
    `Campaign Decision Score ${overall}/100 (${label(overall)}).`,
    ...dimensions.flatMap((d) =>
      d.deductions.length
        ? d.deductions.map((ded) => `${d.label}: −${ded.points} — ${ded.reason}`)
        : [`${d.label}: ${d.score}/100.`]
    )
  );

  return { overall, label: label(overall), dimensions, explainability };
}
