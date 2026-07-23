import type { CampaignForecast, CreatorForecast } from "@/lib/campaign-forecast";

import {
  HEALTH_SCORE_WEIGHTS,
  HIGH_COST_PER_REACH_MULTIPLIER,
  HIGH_OVERLAP_RATIO_THRESHOLD,
  LOW_REACH_EFFICIENCY_THRESHOLD,
  PLATFORM_CONCENTRATION_THRESHOLD,
  REACH_CONCENTRATION_THRESHOLD,
  resolvePlatformBenchmark,
  tierFromFollowers,
} from "./config";
import type {
  CampaignHealthScore,
  CampaignOptimizationContext,
  HealthScoreDeduction,
  HealthScoreDimension,
  OptimizationOpportunity,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function healthLabel(score: number): CampaignHealthScore["label"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "needs_work";
}

function creatorTier(creator: CreatorForecast, context?: CampaignOptimizationContext): string {
  return context?.creatorTiers?.[creator.creatorKey] ?? tierFromFollowers(creator.followers);
}

function shareMap<T extends string>(
  items: T[]
): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  const total = items.length || 1;
  return new Map([...counts.entries()].map(([key, count]) => [key, count / total]));
}

export function computeCampaignHealthScore(
  forecast: CampaignForecast,
  context?: CampaignOptimizationContext
): CampaignHealthScore {
  const creators = [...forecast.creatorForecasts];
  const explainability: string[] = [];
  const dimensions: HealthScoreDimension[] = [];

  // Forecast confidence
  const confidenceDeductions: HealthScoreDeduction[] = [];
  let confidenceScore = forecast.confidenceScore.score;
  if (confidenceScore < 70) {
    confidenceDeductions.push({
      factor: "low_forecast_confidence",
      points: 70 - confidenceScore,
      reason: `Forecast confidence ${confidenceScore}/100 — limited historical signals on the roster.`,
    });
  }
  dimensions.push(buildDimension("forecastConfidence", "Forecast Confidence", confidenceScore, confidenceDeductions));

  // Reach efficiency — net reach vs gross, penalize overlap
  const overlapRatio =
    forecast.grossReach > 0 ? forecast.overlapDeduction / forecast.grossReach : 0;
  const reachEfficiencyRatio =
    forecast.audienceSize > 0 ? forecast.estimatedReach / forecast.audienceSize : 0;
  const reachDeductions: HealthScoreDeduction[] = [];
  let reachScore = clamp(reachEfficiencyRatio * 100);
  if (overlapRatio > HIGH_OVERLAP_RATIO_THRESHOLD) {
    const penalty = clamp((overlapRatio - HIGH_OVERLAP_RATIO_THRESHOLD) * 200, 0, 35);
    reachScore = clamp(reachScore - penalty);
    reachDeductions.push({
      factor: "audience_overlap",
      points: penalty,
      reason: `Audience overlap deducts ${Math.round(overlapRatio * 100)}% of gross reach.`,
    });
  }
  if (reachEfficiencyRatio < LOW_REACH_EFFICIENCY_THRESHOLD) {
    const penalty = clamp((LOW_REACH_EFFICIENCY_THRESHOLD - reachEfficiencyRatio) * 120, 0, 25);
    reachScore = clamp(reachScore - penalty);
    reachDeductions.push({
      factor: "low_net_reach",
      points: penalty,
      reason: `Net reach is only ${Math.round(reachEfficiencyRatio * 100)}% of audience size.`,
    });
  }
  dimensions.push(buildDimension("reachEfficiency", "Reach Efficiency", reachScore, reachDeductions));

  // Budget efficiency
  const budget = context?.budget?.amount ?? 0;
  const budgetDeductions: HealthScoreDeduction[] = [];
  let budgetScore = 65;
  if (budget > 0 && forecast.estimatedImpressions > 0) {
    const impressionsPerUnit = forecast.estimatedImpressions / budget;
    budgetScore = clamp(45 + 18 * Math.log10(Math.max(impressionsPerUnit, 0.01)));
    if (forecast.estimatedReach > 0) {
      const costPerReach = budget / forecast.estimatedReach;
      const benchmarkCpr = 0.015;
      if (costPerReach > benchmarkCpr * HIGH_COST_PER_REACH_MULTIPLIER) {
        const penalty = clamp((costPerReach / benchmarkCpr - 1) * 15, 0, 30);
        budgetScore = clamp(budgetScore - penalty);
        budgetDeductions.push({
          factor: "high_cost_per_reach",
          points: penalty,
          reason: `Cost per reach ${costPerReach.toFixed(4)} exceeds efficient benchmark.`,
        });
      }
    }
  } else {
    budgetDeductions.push({
      factor: "missing_budget",
      points: 0,
      reason: "No budget context supplied — neutral budget efficiency score applied.",
    });
  }
  dimensions.push(buildDimension("budgetEfficiency", "Budget Efficiency", budgetScore, budgetDeductions));

  // Audience quality — creator confidence + ER vs benchmark
  const benchmark = resolvePlatformBenchmark(context?.campaignPlatform ?? creators[0]?.platform);
  const avgCreatorConfidence =
    creators.length > 0
      ? creators.reduce((sum, c) => sum + c.confidence.score, 0) / creators.length
      : 50;
  const audienceDeductions: HealthScoreDeduction[] = [];
  let audienceScore = clamp(avgCreatorConfidence * 0.6);
  if (forecast.averageEngagementRate != null) {
    audienceScore = clamp(audienceScore + 40 * (forecast.averageEngagementRate / benchmark));
  } else {
    audienceDeductions.push({
      factor: "missing_er",
      points: 15,
      reason: "Roster engagement rate unavailable — audience quality capped.",
    });
    audienceScore = clamp(audienceScore - 10);
  }
  dimensions.push(buildDimension("audienceQuality", "Audience Quality", audienceScore, audienceDeductions));

  // Creator diversity — tier spread + reach concentration
  const diversityDeductions: HealthScoreDeduction[] = [];
  const tiers = creators.map((c) => creatorTier(c, context));
  const tierShares = shareMap(tiers);
  const uniqueTiers = tierShares.size;
  let diversityScore = clamp(Math.min(uniqueTiers / 4, 1) * 70);
  const topReachShare =
    forecast.estimatedReach > 0
      ? Math.max(...creators.map((c) => c.estimatedReach), 0) / forecast.estimatedReach
      : 0;
  if (topReachShare > REACH_CONCENTRATION_THRESHOLD && creators.length > 1) {
    const penalty = clamp((topReachShare - REACH_CONCENTRATION_THRESHOLD) * 100, 0, 30);
    diversityScore = clamp(diversityScore - penalty);
    diversityDeductions.push({
      factor: "reach_concentration",
      points: penalty,
      reason: `Top creator contributes ${Math.round(topReachShare * 100)}% of net reach.`,
    });
  }
  dimensions.push(buildDimension("creatorDiversity", "Creator Diversity", diversityScore, diversityDeductions));

  // Platform balance
  const platforms = creators.flatMap((c) => (c.platform ? [c.platform] : c.platforms));
  const platformShares = shareMap(platforms);
  const maxPlatformShare = Math.max(...platformShares.values(), 0);
  const platformDeductions: HealthScoreDeduction[] = [];
  let platformScore = clamp(100 - maxPlatformShare * 60);
  if (maxPlatformShare > PLATFORM_CONCENTRATION_THRESHOLD) {
    const penalty = clamp((maxPlatformShare - PLATFORM_CONCENTRATION_THRESHOLD) * 80, 0, 25);
    platformScore = clamp(platformScore - penalty);
    platformDeductions.push({
      factor: "platform_concentration",
      points: penalty,
      reason: `One platform holds ${Math.round(maxPlatformShare * 100)}% of the roster.`,
    });
  }
  dimensions.push(buildDimension("platformBalance", "Platform Balance", platformScore, platformDeductions));

  const overall = clamp(
    dimensions.reduce((sum, dimension) => sum + dimension.weightedContribution, 0)
  );

  explainability.push(
    `Campaign health ${overall}/100 (${healthLabel(overall)}) from ${dimensions.length} weighted dimensions.`,
    ...dimensions.flatMap((d) =>
      d.deductions.length
        ? d.deductions.map((deduction) => `${d.label}: −${deduction.points} — ${deduction.reason}`)
        : [`${d.label}: ${d.score}/100 (no deductions).`]
    )
  );

  return { overall, label: healthLabel(overall), dimensions, explainability };
}

function buildDimension(
  key: keyof typeof HEALTH_SCORE_WEIGHTS,
  label: string,
  score: number,
  deductions: HealthScoreDeduction[]
): HealthScoreDimension {
  const weight = HEALTH_SCORE_WEIGHTS[key];
  return {
    key,
    label,
    score: clamp(score),
    weight,
    weightedContribution: clamp((clamp(score) * weight) / 100),
    deductions,
  };
}

export function computeOptimizationScore(
  healthOverall: number,
  opportunities: OptimizationOpportunity[]
): number {
  const upside = opportunities.reduce((sum, opp) => {
    const gain =
      opp.expectedReachGainPct ??
      opp.expectedEngagementGainPct ??
      opp.expectedViewGainPct ??
      opp.expectedBudgetSavingsPct ??
      0;
    const weight = opp.impact === "high" ? 1 : opp.impact === "medium" ? 0.6 : 0.3;
    return sum + gain * weight * 0.12;
  }, 0);
  return clamp(Math.min(100, healthOverall + upside));
}
