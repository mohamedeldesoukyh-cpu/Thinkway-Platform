import { STRATEGY_SCORE_WEIGHTS } from "./config";
import type {
  AudienceStrategy,
  BudgetStrategy,
  CampaignPlanningInput,
  CreatorMixStrategy,
  PlatformStrategy,
  StrategyQualityScore,
  TimelineStrategy,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function label(score: number): StrategyQualityScore["label"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "needs_work";
}

function buildDimension(
  key: keyof typeof STRATEGY_SCORE_WEIGHTS,
  labelText: string,
  score: number,
  deductions: StrategyQualityScore["dimensions"][number]["deductions"]
) {
  const weight = STRATEGY_SCORE_WEIGHTS[key];
  return {
    key,
    label: labelText,
    score: clamp(score),
    weight,
    weightedContribution: clamp((clamp(score) * weight) / 100),
    deductions,
  };
}

export function computeStrategyQualityScore(input: {
  planning: CampaignPlanningInput;
  creatorMix: CreatorMixStrategy;
  platformStrategy: PlatformStrategy;
  budgetStrategy: BudgetStrategy;
  timelineStrategy: TimelineStrategy;
  audienceStrategy: AudienceStrategy;
}): StrategyQualityScore {
  const brief = input.planning.brief;
  const dimensions = [];

  let objectiveScore = 55;
  const objectiveDeductions: StrategyQualityScore["dimensions"][number]["deductions"] = [];
  if (brief.objective) objectiveScore += 25;
  else objectiveDeductions.push({ factor: "missing_objective", points: 25, reason: "No objective in brief — defaults applied." });
  if (brief.kpis?.length) objectiveScore += 10;
  dimensions.push(buildDimension("objectiveAlignment", "Objective Alignment", objectiveScore, objectiveDeductions));

  let budgetScore = 50;
  const budgetDeductions: StrategyQualityScore["dimensions"][number]["deductions"] = [];
  if (brief.budget?.amount) budgetScore += 30;
  else budgetDeductions.push({ factor: "missing_budget", points: 30, reason: "Budget not specified — allocations use placeholder." });
  if (input.budgetStrategy.creatorTierAllocations.length >= 2) budgetScore += 10;
  dimensions.push(buildDimension("budgetEfficiency", "Budget Efficiency", budgetScore, budgetDeductions));

  let audienceScore = 60;
  const audienceDeductions: StrategyQualityScore["dimensions"][number]["deductions"] = [];
  for (const gap of input.audienceStrategy.gaps) {
    audienceScore -= 8;
    audienceDeductions.push({ factor: "audience_gap", points: 8, reason: gap });
  }
  if (brief.geography?.length) audienceScore += 15;
  dimensions.push(buildDimension("audienceAlignment", "Audience Alignment", audienceScore, audienceDeductions));

  const maxPlatformShare = Math.max(...input.platformStrategy.platforms.map((p) => p.budgetPercent), 0);
  let platformScore = clamp(100 - maxPlatformShare * 0.45);
  const platformDeductions: StrategyQualityScore["dimensions"][number]["deductions"] = [];
  if (maxPlatformShare > 70) {
    platformDeductions.push({
      factor: "platform_concentration",
      points: 15,
      reason: `Primary platform holds ${maxPlatformShare}% of budget.`,
    });
  }
  dimensions.push(buildDimension("platformBalance", "Platform Balance", platformScore, platformDeductions));

  const uniqueTiers = new Set(input.creatorMix.tiers.map((t) => t.tier)).size;
  let diversityScore = clamp(Math.min(uniqueTiers / 4, 1) * 80 + 10);
  const diversityDeductions: StrategyQualityScore["dimensions"][number]["deductions"] = [];
  if (uniqueTiers < 2) {
    diversityDeductions.push({ factor: "low_tier_diversity", points: 20, reason: "Fewer than 2 creator tiers in mix." });
    diversityScore -= 20;
  }
  dimensions.push(buildDimension("creatorDiversity", "Creator Diversity", diversityScore, diversityDeductions));

  let timelineScore = 65;
  const timelineDeductions: StrategyQualityScore["dimensions"][number]["deductions"] = [];
  if (brief.durationWeeks) timelineScore += 20;
  else timelineDeductions.push({ factor: "missing_duration", points: 20, reason: "Timeline uses default 8-week duration." });
  if (input.timelineStrategy.waves.length >= 2) timelineScore += 10;
  dimensions.push(buildDimension("timelineFeasibility", "Timeline Feasibility", timelineScore, timelineDeductions));

  const overall = clamp(dimensions.reduce((sum, d) => sum + d.weightedContribution, 0));
  const recommendations: string[] = [];
  if (overall < 70) recommendations.push("Refine geography and audience before running Discovery.");
  if (!brief.budget?.amount) recommendations.push("Add budget to improve allocation accuracy.");
  if (input.audienceStrategy.gaps.length) recommendations.push("Close audience gaps listed in strategy before creator search.");

  const explainability = [
    `Strategy quality ${overall}/100 (${label(overall)}).`,
    ...dimensions.flatMap((d) =>
      d.deductions.length
        ? d.deductions.map((ded) => `${d.label}: −${ded.points} — ${ded.reason}`)
        : [`${d.label}: ${d.score}/100.`]
    ),
  ];

  return { overall, label: label(overall), dimensions, recommendations, explainability };
}
