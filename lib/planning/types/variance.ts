import type { BudgetFinancialFields } from "@/lib/planning/types/budget";
import type { PlanningRollupLevel } from "@/lib/planning/types/dimensions";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";

export type PlanningActualFields = {
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  collected_revenue: number;
  vendor_payable: number;
  po_consumed: number;
};

export type PlanningVarianceAmounts = {
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  collections: number;
  vendor_cost: number;
  po: number;
};

export type PlanningVariancePercents = {
  revenue: number;
  cost: number;
  gp: number;
  collections: number;
  vendor_cost: number;
  po: number;
};

export type VarianceAnalysis = {
  level: PlanningRollupLevel;
  key: string;
  label: string;
  currency: AnalyticsCurrencyContext;
  budget: BudgetFinancialFields;
  actual: PlanningActualFields;
  variance_amount: PlanningVarianceAmounts;
  variance_percent: PlanningVariancePercents;
  line_count: number;
};
