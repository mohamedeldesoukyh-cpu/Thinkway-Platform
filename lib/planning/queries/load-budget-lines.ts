import type { SupabaseClient } from "@supabase/supabase-js";

import { devLog } from "@/lib/dev-log";
import { normalizeBudgetLineRow } from "@/lib/planning/budgets/budget-amounts";
import type { BudgetLine } from "@/lib/planning/types/budget";
import {
  buildPlanningCacheKey,
  withPlanningCache,
} from "@/lib/planning/queries/planning-cache";

export type LoadBudgetLinesOptions = {
  budgetPeriodId?: string;
  limit?: number;
};

export async function loadBudgetLines(
  supabase: SupabaseClient,
  budgetVersionId: string,
  options: LoadBudgetLinesOptions = {}
): Promise<BudgetLine[]> {
  const cacheKey = buildPlanningCacheKey("lines", {
    versionId: budgetVersionId,
    periodId: options.budgetPeriodId,
    limit: options.limit,
  });

  return withPlanningCache(cacheKey, async () => {
    let query = supabase
      .from("budget_lines")
      .select(
        `
        id, budget_version_id, budget_period_id, currency_code,
        country_code, client_id, brand_id, campaign_header_id,
        team_id, sales_owner_id, business_unit_id, line_label,
        revenue_budget, cost_budget, gp_budget, margin_budget,
        collections_budget, vendor_cost_budget, po_budget, sort_order
      `
      )
      .eq("budget_version_id", budgetVersionId)
      .order("sort_order", { ascending: true });

    if (options.budgetPeriodId) {
      query = query.eq("budget_period_id", options.budgetPeriodId);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const amounts = normalizeBudgetLineRow({
        revenue_budget: Number(r.revenue_budget),
        cost_budget: Number(r.cost_budget),
        gp_budget: Number(r.gp_budget),
        margin_budget: Number(r.margin_budget),
        collections_budget: Number(r.collections_budget),
        vendor_cost_budget: Number(r.vendor_cost_budget),
        po_budget: Number(r.po_budget),
      });
      return {
        id: String(r.id),
        budget_version_id: String(r.budget_version_id),
        budget_period_id: (r.budget_period_id as string | null) ?? null,
        currency_code: String(r.currency_code),
        country_code: (r.country_code as string | null) ?? null,
        client_id: (r.client_id as string | null) ?? null,
        brand_id: (r.brand_id as string | null) ?? null,
        campaign_header_id: (r.campaign_header_id as string | null) ?? null,
        team_id: (r.team_id as string | null) ?? null,
        sales_owner_id: (r.sales_owner_id as string | null) ?? null,
        business_unit_id: (r.business_unit_id as string | null) ?? null,
        line_label: (r.line_label as string | null) ?? null,
        sort_order: Number(r.sort_order),
        ...amounts,
      } satisfies BudgetLine;
    });

    if (process.env.NODE_ENV === "development") {
      devLog("[planning-query] loadBudgetLines", {
        versionId: budgetVersionId,
        count: rows.length,
      });
    }

    return rows;
  });
}
