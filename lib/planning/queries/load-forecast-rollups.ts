import type { SupabaseClient } from "@supabase/supabase-js";

import { devLog } from "@/lib/dev-log";
import {
  rollupForecastGlobal,
  rollupForecastLines,
} from "@/lib/planning/forecasts/forecast-rollups";
import type { ForecastLine, ForecastVersion } from "@/lib/planning/types/forecast";
import type { PlanningRollupLevel } from "@/lib/planning/types/dimensions";
import type { BudgetRollupNode } from "@/lib/planning/budgets/budget-rollups";
import {
  buildPlanningCacheKey,
  withPlanningCache,
} from "@/lib/planning/queries/planning-cache";

async function loadForecastLines(
  supabase: SupabaseClient,
  forecastVersionId: string
): Promise<ForecastLine[]> {
  const { data, error } = await supabase
    .from("forecast_lines")
    .select(
      `
      id, forecast_version_id, budget_period_id, currency_code,
      country_code, client_id, brand_id, campaign_header_id,
      team_id, sales_owner_id, business_unit_id, line_label,
      revenue_forecast, cost_forecast, gp_forecast, margin_forecast,
      collections_forecast, vendor_cost_forecast, po_forecast, sort_order
    `
    )
    .eq("forecast_version_id", forecastVersionId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ForecastLine[];
}

export async function loadForecastVersions(
  supabase: SupabaseClient,
  options: { fiscalYear?: number; limit?: number } = {}
): Promise<ForecastVersion[]> {
  let query = supabase
    .from("forecast_versions")
    .select(
      `
      id, document_number, name, fiscal_year, status, budget_version_id,
      scenario_id, currency_code, version_number, notes, created_at, updated_at
    `
    )
    .order("fiscal_year", { ascending: false });

  if (options.fiscalYear) {
    query = query.eq("fiscal_year", options.fiscalYear);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ForecastVersion[];
}

export type ForecastRollupsResult = {
  level: PlanningRollupLevel;
  nodes: BudgetRollupNode[];
  global: BudgetRollupNode;
};

export async function loadForecastRollups(
  supabase: SupabaseClient,
  forecastVersionId: string,
  level: PlanningRollupLevel = "global"
): Promise<ForecastRollupsResult> {
  const cacheKey = buildPlanningCacheKey("forecast-rollups", {
    versionId: forecastVersionId,
    level,
  });

  return withPlanningCache(cacheKey, async () => {
    const lines = await loadForecastLines(supabase, forecastVersionId);
    const nodes =
      level === "global"
        ? [rollupForecastGlobal(lines)]
        : rollupForecastLines(lines, level);
    const global = rollupForecastGlobal(lines);

    if (process.env.NODE_ENV === "development") {
      devLog("[planning-query] loadForecastRollups", {
        forecastVersionId,
        level,
        lineCount: lines.length,
      });
    }

    return { level, nodes, global };
  });
}
