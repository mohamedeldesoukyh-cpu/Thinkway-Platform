import type { SupabaseClient } from "@supabase/supabase-js";

import { safeLoadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import { devLog } from "@/lib/dev-log";
import {
  budgetLineToRollupInput,
  rollupBudgetGlobal,
  rollupBudgetLines,
  type BudgetRollupNode,
} from "@/lib/planning/budgets/budget-rollups";
import { loadBudgetLines } from "@/lib/planning/queries/load-budget-lines";
import type { PlanningRollupLevel } from "@/lib/planning/types/dimensions";
import {
  buildPlanningCacheKey,
  withPlanningCache,
} from "@/lib/planning/queries/planning-cache";

export type BudgetRollupsResult = {
  level: PlanningRollupLevel;
  nodes: BudgetRollupNode[];
  global: BudgetRollupNode;
};

export async function loadBudgetRollups(
  supabase: SupabaseClient,
  budgetVersionId: string,
  level: PlanningRollupLevel = "global",
  analyticsFilters?: AnalyticsQueryFilters
): Promise<BudgetRollupsResult> {
  const cacheKey = buildPlanningCacheKey("rollups", {
    versionId: budgetVersionId,
    level,
    billing: analyticsFilters?.billingFilter,
  });

  return withPlanningCache(cacheKey, async () => {
    const lines = await loadBudgetLines(supabase, budgetVersionId);

    const snapshot = await safeLoadAnalyticsFacts(supabase, analyticsFilters ?? {});
    const labelByClient = new Map(
      snapshot.facts.map((f) => [f.client_id, f.client_name])
    );
    const labelByCampaign = new Map(
      snapshot.facts.map((f) => [
        f.campaign_header_id,
        `${f.campaign_document_number} · ${f.campaign_name}`,
      ])
    );

    const inputs = lines.map((line) =>
      budgetLineToRollupInput(line, {
        client: line.client_id ? labelByClient.get(line.client_id) : undefined,
        campaign: line.campaign_header_id
          ? labelByCampaign.get(line.campaign_header_id)
          : undefined,
      })
    );

    const nodes =
      level === "global" ? [rollupBudgetGlobal(inputs)] : rollupBudgetLines(inputs, level);
    const global = rollupBudgetGlobal(inputs);

    if (process.env.NODE_ENV === "development") {
      devLog("[planning-query] loadBudgetRollups", {
        versionId: budgetVersionId,
        level,
        nodes: nodes.length,
      });
    }

    return { level, nodes, global };
  });
}
