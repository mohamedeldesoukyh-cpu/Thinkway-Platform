import type { CampaignForecast } from "@/lib/campaign-forecast";

import type {
  OptimizationOpportunity,
  OptimizationScenarioKind,
  ScenarioComparison,
  ScenarioKpiSnapshot,
} from "./types";

function snapshotFromForecast(forecast: CampaignForecast): ScenarioKpiSnapshot {
  return {
    estimatedReach: forecast.estimatedReach,
    estimatedViews: forecast.estimatedViews,
    estimatedEngagements: forecast.estimatedEngagements,
    averageEngagementRate: forecast.averageEngagementRate,
    overlapDeduction: forecast.overlapDeduction,
  };
}

function pctDelta(next: number, current: number): number {
  if (current <= 0) return 0;
  return Number((((next - current) / current) * 100).toFixed(1));
}

function applyGains(
  base: ScenarioKpiSnapshot,
  gains: {
    reachPct?: number;
    viewPct?: number;
    engagementPct?: number;
    overlapReductionPct?: number;
  }
): ScenarioKpiSnapshot {
  const reachMult = 1 + (gains.reachPct ?? 0) / 100;
  const viewMult = 1 + (gains.viewPct ?? 0) / 100;
  const engagementMult = 1 + (gains.engagementPct ?? 0) / 100;
  const overlapMult = 1 - (gains.overlapReductionPct ?? 0) / 100;

  const estimatedReach = Math.round(base.estimatedReach * reachMult);
  const estimatedViews = Math.round(base.estimatedViews * viewMult);
  const estimatedEngagements = Math.round(base.estimatedEngagements * engagementMult);
  const overlapDeduction = Math.round(base.overlapDeduction * overlapMult);

  let averageEngagementRate = base.averageEngagementRate;
  if (averageEngagementRate != null && gains.engagementPct != null) {
    averageEngagementRate = Number((averageEngagementRate * engagementMult).toFixed(2));
  }

  return {
    estimatedReach,
    estimatedViews,
    estimatedEngagements,
    averageEngagementRate,
    overlapDeduction,
  };
}

function maxGain(
  opportunities: OptimizationOpportunity[],
  field: keyof Pick<
    OptimizationOpportunity,
    | "expectedReachGainPct"
    | "expectedViewGainPct"
    | "expectedEngagementGainPct"
    | "expectedBudgetSavingsPct"
  >
): number {
  return opportunities.reduce((max, opp) => {
    const value = opp[field];
    return value != null && value > max ? value : max;
  }, 0);
}

function sumGain(
  opportunities: OptimizationOpportunity[],
  field: keyof Pick<
    OptimizationOpportunity,
    "expectedReachGainPct" | "expectedViewGainPct" | "expectedEngagementGainPct"
  >,
  categories?: OptimizationOpportunity["category"][]
): number {
  return opportunities
    .filter((opp) => !categories || categories.includes(opp.category))
    .reduce((sum, opp) => sum + (opp[field] ?? 0), 0);
}

const SCENARIO_LABELS: Record<OptimizationScenarioKind, string> = {
  current: "Current Campaign",
  reach_optimized: "Optimized for Reach",
  engagement_optimized: "Optimized for Engagement",
  budget_optimized: "Optimized for Budget",
  balanced: "Balanced Strategy",
};

export function buildScenarioComparisons(
  forecast: CampaignForecast,
  opportunities: OptimizationOpportunity[]
): ScenarioComparison[] {
  const current = snapshotFromForecast(forecast);

  const reachGain = Math.min(
    25,
    Math.max(maxGain(opportunities, "expectedReachGainPct"), sumGain(opportunities, "expectedReachGainPct", ["reach"]) * 0.6)
  );
  const viewGain = Math.min(
    30,
    Math.max(maxGain(opportunities, "expectedViewGainPct"), sumGain(opportunities, "expectedViewGainPct", ["platform", "deliverable"]) * 0.5)
  );
  const engagementGain = Math.min(
    22,
    Math.max(
      maxGain(opportunities, "expectedEngagementGainPct"),
      sumGain(opportunities, "expectedEngagementGainPct", ["creator_mix", "audience"]) * 0.55
    )
  );
  const budgetSavings = maxGain(opportunities, "expectedBudgetSavingsPct");
  const overlapReduction = forecast.grossReach > 0 ? Math.min(20, reachGain * 0.7) : 0;

  const scenarios: Array<{
    scenario: OptimizationScenarioKind;
    kpis: ScenarioKpiSnapshot;
    assumptions: string[];
  }> = [
    {
      scenario: "current",
      kpis: current,
      assumptions: ["Baseline forecast from Campaign Forecast Engine — no optimizations applied."],
    },
    {
      scenario: "reach_optimized",
      kpis: applyGains(current, { reachPct: reachGain, overlapReductionPct: overlapReduction }),
      assumptions: [
        `Applies top reach opportunities (+${reachGain}% reach, −${overlapReduction}% overlap deduction).`,
        "Uses same Forecast Engine baseline with documented reach levers.",
      ],
    },
    {
      scenario: "engagement_optimized",
      kpis: applyGains(current, { engagementPct: engagementGain, viewPct: engagementGain * 0.4 }),
      assumptions: [
        `Applies creator-mix and audience opportunities (+${engagementGain}% engagement).`,
        "Micro-creator substitution and niche alignment assumed.",
      ],
    },
    {
      scenario: "budget_optimized",
      kpis: applyGains(current, {
        reachPct: budgetSavings * 0.5,
        viewPct: budgetSavings * 0.6,
        engagementPct: budgetSavings * 0.3,
      }),
      assumptions: [
        `Targets ~${budgetSavings}% budget efficiency improvement via creator cost rebalancing.`,
        "Maintains audience size while improving impressions per budget unit.",
      ],
    },
    {
      scenario: "balanced",
      kpis: applyGains(current, {
        reachPct: reachGain * 0.55,
        viewPct: viewGain * 0.55,
        engagementPct: engagementGain * 0.55,
        overlapReductionPct: overlapReduction * 0.5,
      }),
      assumptions: [
        "Blends reach, engagement, and budget opportunities at 55% of max projected gains.",
        "Recommended when no single KPI should dominate pre-launch.",
      ],
    },
  ];

  return scenarios.map(({ scenario, kpis, assumptions }) => ({
    scenario,
    label: SCENARIO_LABELS[scenario],
    kpis,
    deltaFromCurrent: {
      estimatedReachPct: pctDelta(kpis.estimatedReach, current.estimatedReach),
      estimatedViewsPct: pctDelta(kpis.estimatedViews, current.estimatedViews),
      estimatedEngagementsPct: pctDelta(kpis.estimatedEngagements, current.estimatedEngagements),
    },
    assumptions,
  }));
}
