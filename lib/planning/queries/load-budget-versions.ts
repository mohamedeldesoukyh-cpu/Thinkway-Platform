import type { SupabaseClient } from "@supabase/supabase-js";

import { devLog } from "@/lib/dev-log";
import type { BudgetVersion, BudgetVersionStatus } from "@/lib/planning/types/budget";
import {
  buildPlanningCacheKey,
  withPlanningCache,
} from "@/lib/planning/queries/planning-cache";

export type LoadBudgetVersionsOptions = {
  fiscalYear?: number;
  status?: BudgetVersionStatus | BudgetVersionStatus[];
  limit?: number;
};

export async function loadBudgetVersions(
  supabase: SupabaseClient,
  options: LoadBudgetVersionsOptions = {}
): Promise<BudgetVersion[]> {
  const cacheKey = buildPlanningCacheKey("versions", {
    year: options.fiscalYear,
    status: Array.isArray(options.status)
      ? options.status.join(",")
      : options.status,
    limit: options.limit,
  });

  return withPlanningCache(cacheKey, async () => {
    let query = supabase
      .from("budget_versions")
      .select(
        `
        id, document_number, name, fiscal_year, status, scenario_id,
        currency_code, version_number, parent_version_id, notes,
        submitted_at, approved_at, locked_at, archived_at,
        created_at, updated_at
      `
      )
      .order("fiscal_year", { ascending: false })
      .order("version_number", { ascending: false });

    if (options.fiscalYear) {
      query = query.eq("fiscal_year", options.fiscalYear);
    }
    if (options.status) {
      if (Array.isArray(options.status)) {
        query = query.in("status", options.status);
      } else {
        query = query.eq("status", options.status);
      }
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as BudgetVersion[];

    if (process.env.NODE_ENV === "development") {
      devLog("[planning-query] loadBudgetVersions", { count: rows.length });
    }

    return rows;
  });
}

export async function loadApprovedBudgetVersion(
  supabase: SupabaseClient,
  fiscalYear: number
): Promise<BudgetVersion | null> {
  const versions = await loadBudgetVersions(supabase, {
    fiscalYear,
    status: ["approved", "locked"],
    limit: 1,
  });
  return versions[0] ?? null;
}
