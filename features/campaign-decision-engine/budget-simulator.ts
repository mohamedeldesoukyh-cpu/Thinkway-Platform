/**
 * Budget simulator — live budget simulation presets.
 */

import type {
  CampaignDecisionContext,
  ScenarioChanges,
  SimulationBudget,
} from "./decision-types";
import { simulateKpis } from "./kpi-simulator";

export function applyBudgetDelta(
  budget: SimulationBudget,
  percentChange: number
): SimulationBudget {
  const multiplier = 1 + percentChange / 100;
  return {
    ...budget,
    total: Math.round(budget.total * multiplier),
    creatorFees: Math.round(budget.creatorFees * multiplier),
    production: Math.round(budget.production * multiplier),
    contingency: Math.round(budget.contingency * multiplier),
    percentChange,
  };
}

export function simulateBudgetChange(
  baseline: CampaignDecisionContext,
  changes: ScenarioChanges
): Pick<import("./decision-types").SimulationResult, "budget" | "kpis" | "kpiDeltas"> {
  const percentChange = changes.budgetChange?.percentChange ?? 0;
  const budget = applyBudgetDelta(baseline.budget, percentChange);

  const { kpis, kpiDeltas } = simulateKpis(baseline, {
    budgetMultiplier: 1 + percentChange / 100,
    creatorCount: baseline.creators.length,
    postCount: baseline.kpis.postCount,
    creators: baseline.creators,
  });

  return { budget, kpis, kpiDeltas };
}

export function generateBudgetPresetChanges(): ScenarioChanges[] {
  return [
    { budgetChange: { percentChange: -30, label: "Budget -30%" } },
    { budgetChange: { percentChange: -20, label: "Budget -20%" } },
    { budgetChange: { percentChange: -10, label: "Budget -10%" } },
    { budgetChange: { percentChange: -5, label: "Budget -5%" } },
    { budgetChange: { percentChange: 10, label: "Budget +10%" } },
    { budgetChange: { percentChange: 25, label: "Budget +25%" } },
    { budgetChange: { percentChange: 50, label: "Budget +50%" } },
  ];
}

export function budgetDecisionReason(
  percentChange: number,
  baseline: CampaignDecisionContext
): string {
  if (percentChange < 0) {
    return `A ${Math.abs(percentChange)}% budget reduction proportionally scales reach and creator fees while preserving campaign structure for ${baseline.brand ?? "this brand"}.`;
  }
  if (percentChange > 0) {
    return `A ${percentChange}% budget increase unlocks additional reach and creator capacity, improving KPI targets for ${baseline.objective ?? "campaign objectives"}.`;
  }
  return "Baseline budget maintained — no financial delta applied.";
}
