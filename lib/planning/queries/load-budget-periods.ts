import type { SupabaseClient } from "@supabase/supabase-js";

import { devLog } from "@/lib/dev-log";
import type { BudgetPeriod } from "@/lib/planning/types/budget";
import {
  buildPlanningCacheKey,
  withPlanningCache,
} from "@/lib/planning/queries/planning-cache";

export async function loadBudgetPeriods(
  supabase: SupabaseClient,
  budgetVersionId: string
): Promise<BudgetPeriod[]> {
  const cacheKey = buildPlanningCacheKey("periods", { versionId: budgetVersionId });

  return withPlanningCache(cacheKey, async () => {
    const { data, error } = await supabase
      .from("budget_periods")
      .select(
        "id, budget_version_id, period_type, period_key, period_start, period_end, sort_order"
      )
      .eq("budget_version_id", budgetVersionId)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as BudgetPeriod[];

    if (process.env.NODE_ENV === "development") {
      devLog("[planning-query] loadBudgetPeriods", {
        versionId: budgetVersionId,
        count: rows.length,
      });
    }

    return rows;
  });
}
