import assert from "node:assert/strict";
import { budgetAmounts, buildMonthlyBudgetRows, filterBudgetLines } from "./monthly-budget";
import { buildBudgetPeriodSeeds } from "./period-builder";
import type { BudgetLine } from "../types/budget";
import { emptyBudgetFinancialFields } from "./budget-amounts";

const periods = buildBudgetPeriodSeeds(2026, "monthly").map((p, i) => ({ ...p, id: `p${i}`, budget_version_id: "v" }));
const line = (period: string | null, revenue: number, cost: number, client: string | null = null): BudgetLine => ({
  ...emptyBudgetFinancialFields(), ...budgetAmounts(revenue, cost), id: "line", budget_version_id: "v", budget_period_id: period,
  currency_code: "USD", country_code: null, client_id: client, brand_id: null, campaign_header_id: null,
  team_id: null, sales_owner_id: null, business_unit_id: null, line_label: null, sort_order: 0,
});
assert.equal(budgetAmounts(100, 125).gp_budget, -25);
assert.equal(budgetAmounts(0, 100).gp_budget, -100);
for (const amount of [NaN, Infinity, -1, 1e14]) assert.throws(() => budgetAmounts(amount, 0));
const rows = buildMonthlyBudgetRows(2026, periods, [line("p0", 100, 125), line("p1", 0, 0), line(null, 9000, 0)], [
  { campaign_header_id: "c", date: "2026-01-31", revenue: 4500, cost: 5000, gp: -500 },
  { campaign_header_id: "c", date: "2025-01-31", revenue: 999999, cost: 0, gp: 999999 },
  { campaign_header_id: "c", date: "2026-03-25", revenue: 999999, cost: 0, gp: 999999 },
], 50, "2026-03-15");
assert.equal(rows.length, 12);
assert.equal(rows[0].actualRevenue, 90);
assert.equal(rows[0].actualCost, 100);
assert.equal(rows[0].actualGp, -10);
assert.equal(rows[0].budgetRevenue, 100);
assert.equal(rows[0].budgetGp, -25);
assert.equal(rows[1].hasBudget, true);
assert.equal(rows[2].hasBudget, false);
assert.equal(rows[2].actualRevenue, 0);
assert.equal(rows[0].status, "Completed");
assert.equal(rows[2].status, "In progress");
assert.equal(rows[3].status, "Upcoming");
assert.throws(() => buildMonthlyBudgetRows(2026, periods, [], [], 0));
assert.equal(filterBudgetLines([line("p0", 100, 50, "client-a"), line("p0", 200, 0, "client-b"), line("p0", 300, 0)], { clientIds: ["client-a"] }).length, 1);
console.log("Monthly budgets: loss, zero vs missing, FX, recognition dates, year and dimension scoping passed.");
