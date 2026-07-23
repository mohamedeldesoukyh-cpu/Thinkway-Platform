import type { CampaignForecast } from "@/lib/campaign-forecast";
import type { CampaignOptimizationReport } from "@/lib/campaign-optimization";

import { READINESS_RISK_THRESHOLDS } from "./config";
import type { CampaignConfiguration, CampaignRisk, LaunchReadiness } from "./types";

export function assessLaunchReadiness(input: {
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
  configuration?: CampaignConfiguration;
  risks: CampaignRisk[];
  minKpiProbability: number;
}): { readiness: LaunchReadiness; label: string; reasoning: string[] } {
  const reasoning: string[] = [];
  const highRisks = input.risks.filter((r) => r.severity === "high" || r.severity === "critical");
  const mediumRisks = input.risks.filter((r) => r.severity === "medium");
  const operational = input.configuration?.operational;
  const operationalGaps =
    (operational?.planMandatoryMissing?.length ?? 0) +
    (operational?.operationalMandatoryMissing?.length ?? 0);

  if (operational?.planReadinessStatus === "not_ready" || operationalGaps >= 3) {
    reasoning.push("Mandatory plan or operational items are incomplete.");
    return { readiness: "not_ready", label: "Not Ready", reasoning };
  }

  if (
    input.forecast.creatorForecasts.length === 0 ||
    input.forecast.estimatedReach <= 0
  ) {
    reasoning.push("No forecastable creator roster or zero projected reach.");
    return { readiness: "not_ready", label: "Not Ready", reasoning };
  }

  if (highRisks.length >= READINESS_RISK_THRESHOLDS.notReadyMinHighRisks) {
    reasoning.push(`${highRisks.length} high/critical risks exceed not-ready threshold.`);
    return { readiness: "not_ready", label: "Not Ready", reasoning };
  }

  if (input.minKpiProbability < 50) {
    reasoning.push(`Lowest KPI achievement probability ${input.minKpiProbability}% under 50%.`);
    return { readiness: "high_risk", label: "High Risk", reasoning };
  }

  if (highRisks.length >= READINESS_RISK_THRESHOLDS.highRiskMinHighRisks) {
    reasoning.push(`${highRisks.length} high-severity risks detected.`);
    return { readiness: "high_risk", label: "High Risk", reasoning };
  }

  if (
    mediumRisks.length >= READINESS_RISK_THRESHOLDS.needsReviewMinMediumRisks ||
    input.optimization.healthScore.overall < 55 ||
    input.minKpiProbability < 65
  ) {
    reasoning.push("Multiple medium risks or suboptimal optimization/KPI confidence.");
    return { readiness: "needs_review", label: "Needs Review", reasoning };
  }

  if (
    highRisks.length <= READINESS_RISK_THRESHOLDS.readyWithMinorMaxHighRisks &&
    (mediumRisks.length > 0 ||
      input.optimization.healthScore.overall < 75 ||
      operationalGaps > 0)
  ) {
    reasoning.push("Campaign is viable but carries addressable risks before launch.");
    return { readiness: "ready_with_minor_risks", label: "Ready with Minor Risks", reasoning };
  }

  reasoning.push("Forecast confidence, optimization quality, and risk profile support launch.");
  return { readiness: "ready", label: "Ready", reasoning };
}

export function readinessBlocksApproval(readiness: LaunchReadiness): boolean {
  return readiness === "not_ready" || readiness === "high_risk";
}
