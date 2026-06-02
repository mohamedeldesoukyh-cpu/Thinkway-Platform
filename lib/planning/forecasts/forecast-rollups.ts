import { devLog } from "@/lib/dev-log";
import {
  budgetFieldsFromForecast,
  normalizeBudgetLineRow,
} from "@/lib/planning/budgets/budget-amounts";
import {
  rollupBudgetGlobal,
  rollupBudgetLines,
  type BudgetRollupInput,
  type BudgetRollupNode,
} from "@/lib/planning/budgets/budget-rollups";
import type { ForecastLine } from "@/lib/planning/types/forecast";
import type { PlanningRollupLevel } from "@/lib/planning/types/dimensions";

export function forecastLineToRollupInput(line: ForecastLine): BudgetRollupInput {
  const budget = budgetFieldsFromForecast({
    revenue_forecast: Number(line.revenue_forecast),
    cost_forecast: Number(line.cost_forecast),
    gp_forecast: Number(line.gp_forecast),
    margin_forecast: Number(line.margin_forecast),
    collections_forecast: Number(line.collections_forecast),
    vendor_cost_forecast: Number(line.vendor_cost_forecast),
    po_forecast: Number(line.po_forecast),
  });

  return {
    country_code: line.country_code,
    client_id: line.client_id,
    brand_id: line.brand_id,
    campaign_header_id: line.campaign_header_id,
    team_id: line.team_id,
    sales_owner_id: line.sales_owner_id,
    business_unit_id: line.business_unit_id,
    currency_code: line.currency_code,
    ...normalizeBudgetLineRow(budget),
  };
}

export function rollupForecastLines(
  lines: ForecastLine[],
  level: PlanningRollupLevel
): BudgetRollupNode[] {
  const inputs = lines.map(forecastLineToRollupInput);
  const nodes = rollupBudgetLines(inputs, level);

  if (process.env.NODE_ENV === "development") {
    devLog("[forecast-rollup] computed forecast rollup", {
      level,
      lineCount: lines.length,
    });
  }

  return nodes;
}

export function rollupForecastGlobal(lines: ForecastLine[]): BudgetRollupNode {
  return rollupBudgetGlobal(lines.map(forecastLineToRollupInput));
}
