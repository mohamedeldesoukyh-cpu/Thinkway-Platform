import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { RecognitionEvent } from "@/lib/analytics/queries/reporting-financials";
import type { BudgetLine, BudgetPeriod } from "@/lib/planning/types/budget";

export function budgetAmounts(revenue: number, cost: number) {
  if (![revenue, cost].every(n => Number.isFinite(n) && n >= 0 && n <= 999999999999.99)) {
    throw new Error("Enter valid, non-negative revenue and cost amounts.");
  }
  const revenue_budget = roundMoney(revenue);
  const cost_budget = roundMoney(cost);
  const gp_budget = roundMoney(revenue_budget - cost_budget);
  const margin_budget = revenue_budget > 0 ? roundMoney(gp_budget / revenue_budget * 100) : 0;
  if (Math.abs(margin_budget) >= 10000) throw new Error("The margin is outside the supported range. Check revenue and cost.");
  return { revenue_budget, cost_budget, gp_budget, margin_budget };
}

export function filterBudgetLines(lines: BudgetLine[], filters: AnalyticsQueryFilters = {}) {
  return lines.filter(l =>
    (!filters.clientIds?.length || !!l.client_id && filters.clientIds.includes(l.client_id)) &&
    (!filters.brandIds?.length || !!l.brand_id && filters.brandIds.includes(l.brand_id)) &&
    (!filters.countryCodes?.length || !!l.country_code && filters.countryCodes.includes(l.country_code)) &&
    (!filters.teamIds?.length || !!l.team_id && filters.teamIds.includes(l.team_id)) &&
    (!filters.campaignHeaderIds?.length || !!l.campaign_header_id && filters.campaignHeaderIds.includes(l.campaign_header_id)));
}

export type MonthlyBudgetRow = {
  key: string; label: string; status: "Completed" | "In progress" | "Upcoming";
  budgetRevenue: number; budgetCost: number; budgetGp: number;
  actualRevenue: number; actualCost: number; actualGp: number; hasBudget: boolean;
};

export function buildMonthlyBudgetRows(year: number, periods: BudgetPeriod[], lines: BudgetLine[], events: RecognitionEvent[], rateToEgp = 1, today = new Date().toISOString().slice(0, 10)): MonthlyBudgetRow[] {
  if (!Number.isFinite(rateToEgp) || rateToEgp <= 0) throw new Error("Budget currency exchange rate is unavailable.");
  return Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const periodIds = new Set(periods.filter(p => p.period_type === "monthly" && p.period_start.slice(0, 7) === key).map(p => p.id));
    const budget = lines.filter(l => l.budget_period_id && periodIds.has(l.budget_period_id));
    const actual = events.filter(e => e.date.slice(0, 7) === key && e.date <= today);
    const budgetRevenue = roundMoney(budget.reduce((n, l) => n + l.revenue_budget, 0));
    const budgetCost = roundMoney(budget.reduce((n, l) => n + l.cost_budget, 0));
    const actualRevenue = roundMoney(actual.reduce((n, e) => n + e.revenue, 0) / rateToEgp);
    const actualCost = roundMoney(actual.reduce((n, e) => n + e.cost, 0) / rateToEgp);
    return { key, label: new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, index, 1))),
      status: key < today.slice(0, 7) ? "Completed" : key === today.slice(0, 7) ? "In progress" : "Upcoming",
      budgetRevenue, budgetCost, budgetGp: roundMoney(budgetRevenue - budgetCost), actualRevenue, actualCost,
      actualGp: roundMoney(actualRevenue - actualCost), hasBudget: budget.length > 0 };
  });
}
