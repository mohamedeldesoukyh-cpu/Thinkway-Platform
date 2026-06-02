import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { BudgetFinancialFields } from "@/lib/planning/types/budget";
import type { ForecastFinancialFields } from "@/lib/planning/types/forecast";

export function emptyBudgetFinancialFields(): BudgetFinancialFields {
  return {
    revenue_budget: 0,
    cost_budget: 0,
    gp_budget: 0,
    margin_budget: 0,
    collections_budget: 0,
    vendor_cost_budget: 0,
    po_budget: 0,
  };
}

export function mergeBudgetFinancialFields(
  base: BudgetFinancialFields,
  add: Partial<BudgetFinancialFields>
): BudgetFinancialFields {
  const revenue_budget = roundMoney(base.revenue_budget + (add.revenue_budget ?? 0));
  const cost_budget = roundMoney(base.cost_budget + (add.cost_budget ?? 0));
  const gp_budget = roundMoney(base.gp_budget + (add.gp_budget ?? 0));
  const collections_budget = roundMoney(
    base.collections_budget + (add.collections_budget ?? 0)
  );
  const vendor_cost_budget = roundMoney(
    base.vendor_cost_budget + (add.vendor_cost_budget ?? 0)
  );
  const po_budget = roundMoney(base.po_budget + (add.po_budget ?? 0));
  const margin_budget =
    revenue_budget > 0
      ? Math.round((gp_budget / revenue_budget) * 10000) / 100
      : 0;

  return {
    revenue_budget,
    cost_budget,
    gp_budget,
    margin_budget,
    collections_budget,
    vendor_cost_budget,
    po_budget,
  };
}

export function budgetFieldsFromForecast(
  forecast: ForecastFinancialFields
): BudgetFinancialFields {
  return {
    revenue_budget: forecast.revenue_forecast,
    cost_budget: forecast.cost_forecast,
    gp_budget: forecast.gp_forecast,
    margin_budget: forecast.margin_forecast,
    collections_budget: forecast.collections_forecast,
    vendor_cost_budget: forecast.vendor_cost_forecast,
    po_budget: forecast.po_forecast,
  };
}

export function normalizeBudgetLineRow(row: {
  revenue_budget: number;
  cost_budget: number;
  gp_budget: number;
  margin_budget: number;
  collections_budget: number;
  vendor_cost_budget: number;
  po_budget: number;
}): BudgetFinancialFields {
  return {
    revenue_budget: roundMoney(Number(row.revenue_budget)),
    cost_budget: roundMoney(Number(row.cost_budget)),
    gp_budget: roundMoney(Number(row.gp_budget)),
    margin_budget: roundMoney(Number(row.margin_budget)),
    collections_budget: roundMoney(Number(row.collections_budget)),
    vendor_cost_budget: roundMoney(Number(row.vendor_cost_budget)),
    po_budget: roundMoney(Number(row.po_budget)),
  };
}
