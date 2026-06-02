export type {
  PlanningDimensionKey,
  PlanningRollupLevel,
  PlanningDimension,
  BudgetVersionStatus,
  BudgetPeriodType,
  BudgetFinancialFields,
  BudgetVersion,
  BudgetPeriod,
  BudgetLine,
  BudgetAllocation,
  ForecastVersionStatus,
  ForecastFinancialFields,
  ForecastVersion,
  ForecastLine,
  PlanningActualFields,
  PlanningVarianceAmounts,
  PlanningVariancePercents,
  VarianceAnalysis,
} from "@/lib/planning/types";

export { EMPTY_PLANNING_DIMENSION } from "@/lib/planning/types/dimensions";

export {
  emptyBudgetFinancialFields,
  mergeBudgetFinancialFields,
  budgetFieldsFromForecast,
  normalizeBudgetLineRow,
} from "@/lib/planning/budgets/budget-amounts";

export {
  budgetVersionIsReadOnly,
  budgetVersionAllowsLineWrite,
  BUDGET_STATUS_LABELS,
} from "@/lib/planning/budgets/budget-status";

export {
  rollupBudgetLines,
  rollupBudgetGlobal,
  budgetLineToRollupInput,
  type BudgetRollupInput,
  type BudgetRollupNode,
} from "@/lib/planning/budgets/budget-rollups";

export {
  forecastLineToRollupInput,
  rollupForecastLines,
  rollupForecastGlobal,
} from "@/lib/planning/forecasts/forecast-rollups";

export {
  computeVarianceAnalysis,
  actualFieldsFromAnalyticsFact,
  mergeActualFromFacts,
  varianceFromBudgetAndActualRollups,
} from "@/lib/planning/variance/variance-engine";

export { summarizeAllocations, type AllocationSummary } from "@/lib/planning/allocations/allocation-engine";

export {
  canTransitionBudgetStatus,
  PLANNING_AUDIT_ACTIONS,
} from "@/lib/planning/approvals/approval-rules";

export type { PlanningScenario, ScenarioComparisonSlice } from "@/lib/planning/scenarios/scenario-types";

export {
  loadBudgetVersions,
  loadApprovedBudgetVersion,
  loadBudgetPeriods,
  loadBudgetLines,
  loadBudgetRollups,
  loadBudgetVariance,
  loadForecastVersions,
  loadForecastRollups,
  buildPlanningCacheKey,
  withPlanningCache,
  invalidatePlanningCache,
  type LoadBudgetVersionsOptions,
  type LoadBudgetLinesOptions,
  type BudgetRollupsResult,
  type BudgetVarianceResult,
  type ForecastRollupsResult,
} from "@/lib/planning/queries";
