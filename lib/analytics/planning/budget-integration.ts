import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { FinancialMetrics, PlanningBudgetSlice } from "@/lib/analytics/types/metrics";
import type { BudgetFinancialFields } from "@/lib/planning/types/budget";
import type { VarianceAnalysis } from "@/lib/planning/types/variance";

export function emptyPlanningBudgetSlice(): PlanningBudgetSlice {
  return {
    revenue_budget: 0,
    cost_budget: 0,
    gp_budget: 0,
    margin_budget: 0,
    collections_budget: 0,
    vendor_cost_budget: 0,
    po_budget: 0,
    revenue_variance: 0,
    gp_variance: 0,
    revenue_variance_percent: 0,
  };
}

export function planningSliceFromBudgetFields(
  budget: BudgetFinancialFields,
  actual: Pick<FinancialMetrics, "revenue" | "gp">
): PlanningBudgetSlice {
  const revenue_variance = roundMoney(actual.revenue - budget.revenue_budget);
  const gp_variance = roundMoney(actual.gp - budget.gp_budget);
  const revenue_variance_percent =
    budget.revenue_budget > 0
      ? Math.round((revenue_variance / budget.revenue_budget) * 10000) / 100
      : 0;

  return {
    revenue_budget: budget.revenue_budget,
    cost_budget: budget.cost_budget,
    gp_budget: budget.gp_budget,
    margin_budget: budget.margin_budget,
    collections_budget: budget.collections_budget,
    vendor_cost_budget: budget.vendor_cost_budget,
    po_budget: budget.po_budget,
    revenue_variance,
    gp_variance,
    revenue_variance_percent,
  };
}

export function enrichMetricsWithPlanning(
  metrics: FinancialMetrics,
  budget: BudgetFinancialFields
): FinancialMetrics {
  return {
    ...metrics,
    planning: planningSliceFromBudgetFields(budget, metrics),
  };
}

export function mergePlanningBudgetSlices(
  base: PlanningBudgetSlice,
  add: Partial<PlanningBudgetSlice>
): PlanningBudgetSlice {
  const revenue_budget = roundMoney(base.revenue_budget + (add.revenue_budget ?? 0));
  const gp_budget = roundMoney(base.gp_budget + (add.gp_budget ?? 0));
  const revenue_variance = roundMoney(
    base.revenue_variance + (add.revenue_variance ?? 0)
  );

  return {
    revenue_budget,
    cost_budget: roundMoney(base.cost_budget + (add.cost_budget ?? 0)),
    gp_budget,
    margin_budget: roundMoney(base.margin_budget + (add.margin_budget ?? 0)),
    collections_budget: roundMoney(
      base.collections_budget + (add.collections_budget ?? 0)
    ),
    vendor_cost_budget: roundMoney(
      base.vendor_cost_budget + (add.vendor_cost_budget ?? 0)
    ),
    po_budget: roundMoney(base.po_budget + (add.po_budget ?? 0)),
    revenue_variance,
    gp_variance: roundMoney(base.gp_variance + (add.gp_variance ?? 0)),
    revenue_variance_percent:
      revenue_budget > 0
        ? Math.round((revenue_variance / revenue_budget) * 10000) / 100
        : 0,
  };
}

export type PlanningVarianceKpi = {
  id: string;
  label: string;
  budget: number;
  actual: number;
  variance: number;
  variance_percent: number;
};

export function varianceToPlanningKpis(
  variance: VarianceAnalysis
): PlanningVarianceKpi[] {
  return [
    {
      id: "revenue",
      label: "Revenue vs budget",
      budget: variance.budget.revenue_budget,
      actual: variance.actual.revenue,
      variance: variance.variance_amount.revenue,
      variance_percent: variance.variance_percent.revenue,
    },
    {
      id: "gp",
      label: "GP vs budget",
      budget: variance.budget.gp_budget,
      actual: variance.actual.gp,
      variance: variance.variance_amount.gp,
      variance_percent: variance.variance_percent.gp,
    },
    {
      id: "collections",
      label: "Collections vs budget",
      budget: variance.budget.collections_budget,
      actual: variance.actual.collected_revenue,
      variance: variance.variance_amount.collections,
      variance_percent: variance.variance_percent.collections,
    },
  ];
}
