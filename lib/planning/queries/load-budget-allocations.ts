import type { SupabaseClient } from "@supabase/supabase-js";

import { devLog } from "@/lib/platform/logger";
import type { BudgetAllocation } from "@/lib/planning/types/budget";
import {
  buildPlanningCacheKey,
  withPlanningCache,
} from "@/lib/planning/queries/planning-cache";

export async function loadBudgetAllocations(
  supabase: SupabaseClient,
  budgetVersionId: string
): Promise<BudgetAllocation[]> {
  const cacheKey = buildPlanningCacheKey("allocations", { versionId: budgetVersionId });

  return withPlanningCache(cacheKey, async () => {
    const { data: lines, error: linesError } = await supabase
      .from("budget_lines")
      .select("id")
      .eq("budget_version_id", budgetVersionId);

    if (linesError) throw new Error(linesError.message);
    const lineIds = (lines ?? []).map((l) => l.id);
    if (lineIds.length === 0) return [];

    const { data, error } = await supabase
      .from("budget_allocations")
      .select(
        "id, budget_line_id, allocation_type, target_dimension, target_id, allocated_amount, allocation_percent, currency_code, notes"
      )
      .in("budget_line_id", lineIds);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as BudgetAllocation[];

    if (process.env.NODE_ENV === "development") {
      devLog("[planning-query] loadBudgetAllocations", {
        versionId: budgetVersionId,
        count: rows.length,
      });
    }

    return rows;
  });
}
