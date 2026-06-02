import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { BudgetLine } from "@/lib/planning/types/budget";
import type { BudgetPeriod } from "@/lib/planning/types/budget";
import type { VarianceAnalysis } from "@/lib/planning/types/variance";

export type PlanningTrendPoint = {
  period: string;
  label: string;
  value: number;
};

export function buildVarianceTrendFromPeriods(
  periods: BudgetPeriod[],
  lines: BudgetLine[],
  pick: (v: VarianceAnalysis) => number,
  globalVariance?: VarianceAnalysis
): PlanningTrendPoint[] {
  if (periods.length === 0 && globalVariance) {
    return [
      {
        period: "total",
        label: "Total",
        value: roundMoney(pick(globalVariance)),
      },
    ];
  }

  const byPeriod = new Map<string, PlanningTrendPoint>();

  for (const period of periods) {
    byPeriod.set(period.id, {
      period: period.period_key,
      label: period.period_key,
      value: 0,
    });
  }

  for (const line of lines) {
    if (!line.budget_period_id) continue;
    const bucket = byPeriod.get(line.budget_period_id);
    if (!bucket) continue;
    bucket.value = roundMoney(bucket.value + line.revenue_budget);
  }

  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export function buildBudgetMetricTrend(
  periods: BudgetPeriod[],
  lines: BudgetLine[],
  metric: keyof Pick<
    BudgetLine,
    | "revenue_budget"
    | "gp_budget"
    | "collections_budget"
    | "cost_budget"
  >
): PlanningTrendPoint[] {
  const byPeriod = new Map<string, PlanningTrendPoint>();

  for (const period of periods) {
    byPeriod.set(period.id, {
      period: period.period_key,
      label: period.period_key,
      value: 0,
    });
  }

  for (const line of lines) {
    if (!line.budget_period_id) continue;
    const bucket = byPeriod.get(line.budget_period_id);
    if (!bucket) continue;
    bucket.value = roundMoney(bucket.value + Number(line[metric]));
  }

  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export function sortVariancesByMetric(
  variances: VarianceAnalysis[],
  metric: keyof VarianceAnalysis["variance_amount"],
  direction: "asc" | "desc" = "desc"
): VarianceAnalysis[] {
  return [...variances].sort((a, b) => {
    const av = a.variance_amount[metric];
    const bv = b.variance_amount[metric];
    return direction === "desc" ? bv - av : av - bv;
  });
}
