import type {
  CampaignApprovalSummary,
  CampaignDecisionScore,
  CampaignRisk,
  DecisionRecommendation,
  KpiAchievementProbability,
  LaunchReadiness,
} from "./types";

const READINESS_HEADLINES: Record<LaunchReadiness, string> = {
  ready: "Campaign is ready for launch approval.",
  ready_with_minor_risks: "Campaign can proceed after addressing minor risks.",
  needs_review: "Campaign requires review before approval.",
  high_risk: "Campaign carries significant launch risk.",
  not_ready: "Campaign is not ready for launch.",
};

export function buildApprovalSummary(input: {
  readiness: LaunchReadiness;
  readinessLabel: string;
  decisionScore: CampaignDecisionScore;
  risks: CampaignRisk[];
  recommendations: DecisionRecommendation[];
  kpiProbabilities: KpiAchievementProbability[];
  optimizationStrengths: string[];
}): CampaignApprovalSummary {
  const highRisks = input.risks.filter((r) => r.severity === "high" || r.severity === "critical");
  const strengths = [...input.optimizationStrengths];

  if (input.decisionScore.overall >= 75) {
    strengths.push(`Strong decision score (${input.decisionScore.overall}/100).`);
  }
  if (input.kpiProbabilities.some((k) => k.probability >= 80)) {
    const top = [...input.kpiProbabilities].sort((a, b) => b.probability - a.probability)[0];
    if (top) strengths.push(`${top.metric} probability ${top.probability}%.`);
  }

  const riskLines = highRisks.length
    ? highRisks.slice(0, 4).map((r) => r.title)
    : input.risks.slice(0, 3).map((r) => r.title);

  const topRec =
    input.recommendations.find((r) => r.priority === "critical") ??
    input.recommendations[0];

  let recommendation = "Proceed to approval.";
  if (input.readiness === "ready") {
    recommendation = topRec?.kind === "safe_to_launch" ? topRec.action : "Proceed to approval.";
  } else if (input.readiness === "ready_with_minor_risks") {
    recommendation = topRec?.action ?? "Proceed after resolving listed minor risks.";
  } else if (input.readiness === "needs_review") {
    recommendation = topRec?.action ?? "Review risks and re-evaluate before client sign-off.";
  } else {
    recommendation = topRec?.action ?? "Do not approve until critical issues are resolved.";
  }

  return {
    overallAssessment: input.readiness,
    headline: READINESS_HEADLINES[input.readiness],
    strengths: strengths.slice(0, 5),
    risks: riskLines,
    recommendation,
    decisionScore: input.decisionScore.overall,
    readinessLabel: input.readinessLabel,
    kpiHighlights: input.kpiProbabilities
      .filter((k) => k.target != null || k.metric.includes("Awareness"))
      .slice(0, 4)
      .map((k) => ({ metric: k.metric, probability: k.probability })),
  };
}

export function extractOptimizationStrengths(
  optimizationHealth: number,
  forecastConfidence: number
): string[] {
  const strengths: string[] = [];
  if (optimizationHealth >= 70) strengths.push("Solid optimization health score.");
  if (forecastConfidence >= 75) strengths.push("High forecast confidence on roster KPIs.");
  if (optimizationHealth >= 60 && forecastConfidence >= 60) {
    strengths.push("Balanced creator mix and forecast signals.");
  }
  return strengths;
}
