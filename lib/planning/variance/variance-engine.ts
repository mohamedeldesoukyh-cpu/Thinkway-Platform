import { roundMoney } from "@/lib/analytics/aggregations/round";
import { buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { devLog } from "@/lib/dev-log";
import type { CampaignAnalyticsFact } from "@/lib/analytics/types/metrics";
import type { BudgetFinancialFields } from "@/lib/planning/types/budget";
import type {
  PlanningActualFields,
  PlanningVarianceAmounts,
  PlanningVariancePercents,
  VarianceAnalysis,
} from "@/lib/planning/types/variance";
import type { BudgetRollupNode } from "@/lib/planning/budgets/budget-rollups";
import type { PlanningRollupLevel } from "@/lib/planning/types/dimensions";

function variancePercent(budget: number, variance: number): number {
  if (budget <= 0) return 0;
  return Math.round((variance / budget) * 10000) / 100;
}

export function actualFieldsFromAnalyticsFact(
  fact: CampaignAnalyticsFact
): PlanningActualFields {
  return {
    revenue: fact.metrics.revenue,
    cost: fact.metrics.cost,
    gp: fact.metrics.gp,
    margin_percent: fact.metrics.margin_percent,
    collected_revenue: fact.metrics.collected_revenue,
    vendor_payable: fact.metrics.vendor_payable,
    po_consumed: fact.metrics.actual_amount,
  };
}

export function computeVarianceAnalysis(input: {
  level: PlanningRollupLevel;
  key: string;
  label: string;
  budget: BudgetFinancialFields;
  actual: PlanningActualFields;
  currencyCodes: string[];
  line_count?: number;
}): VarianceAnalysis {
  const variance_amount: PlanningVarianceAmounts = {
    revenue: roundMoney(input.actual.revenue - input.budget.revenue_budget),
    cost: roundMoney(input.actual.cost - input.budget.cost_budget),
    gp: roundMoney(input.actual.gp - input.budget.gp_budget),
    margin_percent: roundMoney(
      input.actual.margin_percent - input.budget.margin_budget
    ),
    collections: roundMoney(
      input.actual.collected_revenue - input.budget.collections_budget
    ),
    vendor_cost: roundMoney(
      input.actual.vendor_payable - input.budget.vendor_cost_budget
    ),
    po: roundMoney(input.actual.po_consumed - input.budget.po_budget),
  };

  const variance_percent: PlanningVariancePercents = {
    revenue: variancePercent(input.budget.revenue_budget, variance_amount.revenue),
    cost: variancePercent(input.budget.cost_budget, variance_amount.cost),
    gp: variancePercent(input.budget.gp_budget, variance_amount.gp),
    collections: variancePercent(
      input.budget.collections_budget,
      variance_amount.collections
    ),
    vendor_cost: variancePercent(
      input.budget.vendor_cost_budget,
      variance_amount.vendor_cost
    ),
    po: variancePercent(input.budget.po_budget, variance_amount.po),
  };

  if (process.env.NODE_ENV === "development") {
    devLog("[budget-variance] computed slice", {
      level: input.level,
      key: input.key,
      revenueVar: variance_amount.revenue,
    });
  }

  return {
    level: input.level,
    key: input.key,
    label: input.label,
    currency: buildCurrencyContext(input.currencyCodes, {
      preserveCampaignCurrency: true,
    }),
    budget: input.budget,
    actual: input.actual,
    variance_amount,
    variance_percent,
    line_count: input.line_count ?? 0,
  };
}

export function mergeActualFromFacts(
  facts: CampaignAnalyticsFact[]
): PlanningActualFields {
  let actual: PlanningActualFields = {
    revenue: 0,
    cost: 0,
    gp: 0,
    margin_percent: 0,
    collected_revenue: 0,
    vendor_payable: 0,
    po_consumed: 0,
  };

  for (const fact of facts) {
    const slice = actualFieldsFromAnalyticsFact(fact);
    actual = {
      revenue: roundMoney(actual.revenue + slice.revenue),
      cost: roundMoney(actual.cost + slice.cost),
      gp: roundMoney(actual.gp + slice.gp),
      collected_revenue: roundMoney(
        actual.collected_revenue + slice.collected_revenue
      ),
      vendor_payable: roundMoney(actual.vendor_payable + slice.vendor_payable),
      po_consumed: roundMoney(actual.po_consumed + slice.po_consumed),
      margin_percent: 0,
    };
  }

  actual.margin_percent =
    actual.revenue > 0
      ? Math.round((actual.gp / actual.revenue) * 10000) / 100
      : 0;

  return actual;
}

export function varianceFromBudgetAndActualRollups(
  budgetNode: BudgetRollupNode,
  actual: PlanningActualFields,
  factsForCurrency: CampaignAnalyticsFact[]
): VarianceAnalysis {
  return computeVarianceAnalysis({
    level: budgetNode.level,
    key: budgetNode.key,
    label: budgetNode.label,
    budget: budgetNode.metrics,
    actual,
    currencyCodes: [
      ...budgetNode.currency.currencies,
      ...factsForCurrency.map((f) => f.currency_code),
    ],
    line_count: budgetNode.line_count,
  });
}
