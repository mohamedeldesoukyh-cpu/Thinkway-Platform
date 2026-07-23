import type { CampaignForecast } from "@/lib/campaign-forecast";
import type { CampaignOptimizationReport } from "@/lib/campaign-optimization";

import type { CampaignConfiguration, CampaignRisk, KpiAchievementProbability } from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function confidenceLabel(score: number): "low" | "medium" | "high" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function probabilityForMetric(input: {
  metric: string;
  forecastValue: number | null;
  target: number | null;
  forecastConfidence: number;
  optimizationScore: number;
  riskPenalty: number;
  reasoning: string[];
}): KpiAchievementProbability {
  const base = input.forecastConfidence * 0.55 + input.optimizationScore * 0.25;
  let attainment = 1;
  if (input.target != null && input.target > 0 && input.forecastValue != null) {
    attainment = Math.min(1.15, input.forecastValue / input.target);
    input.reasoning.push(
      `Forecast ${input.forecastValue.toLocaleString()} vs target ${input.target.toLocaleString()} (attainment ${(attainment * 100).toFixed(0)}%).`
    );
  } else {
    input.reasoning.push("No explicit target — probability driven by forecast confidence.");
  }

  const probability = clamp(base * Math.min(attainment, 1) - input.riskPenalty);
  input.reasoning.push(`Base confidence ${input.forecastConfidence}/100; optimization ${input.optimizationScore}/100.`);

  return {
    metric: input.metric,
    target: input.target,
    forecastValue: input.forecastValue,
    probability,
    confidenceLabel: confidenceLabel(probability),
    reasoning: input.reasoning,
  };
}

export function computeKpiProbabilities(input: {
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
  configuration?: CampaignConfiguration;
  risks: CampaignRisk[];
}): KpiAchievementProbability[] {
  const targets = input.configuration?.kpiTargets ?? {};
  const highRiskCount = input.risks.filter(
    (r) => r.severity === "high" || r.severity === "critical"
  ).length;
  const riskPenalty = Math.min(25, highRiskCount * 6 + input.risks.filter((r) => r.severity === "medium").length * 2);

  const reach = probabilityForMetric({
    metric: "Reach Target",
    forecastValue: input.forecast.estimatedReach,
    target: targets.reach ?? null,
    forecastConfidence: input.forecast.confidenceScore.score,
    optimizationScore: input.optimization.optimizationScore,
    riskPenalty,
    reasoning: [`Forecast engine confidence: ${input.forecast.confidenceScore.label}.`],
  });

  const engagement = probabilityForMetric({
    metric: "Engagement Target",
    forecastValue: input.forecast.estimatedEngagements,
    target: targets.engagement ?? null,
    forecastConfidence: input.forecast.confidenceScore.score,
    optimizationScore: input.optimization.healthScore.overall,
    riskPenalty: riskPenalty * 0.8,
    reasoning: [],
  });

  const engagementRate = probabilityForMetric({
    metric: "Engagement Rate Target",
    forecastValue: input.forecast.averageEngagementRate,
    target: targets.engagementRate ?? null,
    forecastConfidence: input.forecast.confidenceScore.score,
    optimizationScore: input.optimization.optimizationScore,
    riskPenalty: riskPenalty * 0.7,
    reasoning: [],
  });

  const impressions = probabilityForMetric({
    metric: "Impressions Target",
    forecastValue: input.forecast.estimatedImpressions,
    target: targets.impressions ?? null,
    forecastConfidence: input.forecast.confidenceScore.score,
    optimizationScore: input.optimization.optimizationScore,
    riskPenalty,
    reasoning: [],
  });

  const views = probabilityForMetric({
    metric: "Views Target",
    forecastValue: input.forecast.estimatedViews,
    target: targets.views ?? null,
    forecastConfidence: input.forecast.confidenceScore.score,
    optimizationScore: input.optimization.optimizationScore,
    riskPenalty,
    reasoning: [],
  });

  const awarenessBase =
    input.forecast.confidenceScore.score * 0.6 +
    input.optimization.healthScore.overall * 0.25 +
    (input.forecast.averageEngagementRate ?? 3) * 3;
  const awareness = {
    metric: "Awareness Objective",
    target: targets.awareness ?? null,
    forecastValue: input.forecast.estimatedReach,
    probability: clamp(awarenessBase - riskPenalty),
    confidenceLabel: confidenceLabel(clamp(awarenessBase - riskPenalty)),
    reasoning: [
      "Awareness probability blends forecast confidence, optimization health, and reach scale.",
      `Forecast confidence ${input.forecast.confidenceScore.score}/100.`,
    ],
  } satisfies KpiAchievementProbability;

  return [reach, engagement, engagementRate, impressions, views, awareness];
}

export function minKpiProbability(probabilities: KpiAchievementProbability[]): number {
  if (!probabilities.length) return 0;
  return Math.min(...probabilities.map((p) => p.probability));
}
