import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupFacts } from "@/lib/analytics/aggregations/rollup-engine";
import { loadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { AnalyticsRollupLevel } from "@/lib/analytics/types/filters";
import { devLog } from "@/lib/dev-log";
import { loadBudgetRollups } from "@/lib/planning/queries/load-budget-rollups";
import type { PlanningRollupLevel } from "@/lib/planning/types/dimensions";
import type { VarianceAnalysis } from "@/lib/planning/types/variance";
import {
  mergeActualFromFacts,
  varianceFromBudgetAndActualRollups,
} from "@/lib/planning/variance/variance-engine";
import {
  buildPlanningCacheKey,
  withPlanningCache,
} from "@/lib/planning/queries/planning-cache";

export type BudgetVarianceResult = {
  level: PlanningRollupLevel;
  variances: VarianceAnalysis[];
  global: VarianceAnalysis;
};

function analyticsLevelForPlanning(
  level: PlanningRollupLevel
): AnalyticsRollupLevel {
  switch (level) {
    case "campaign":
    case "client":
    case "brand":
    case "country":
    case "team":
    case "global":
      return level;
    case "business_unit":
    default:
      return "client";
  }
}

export async function loadBudgetVariance(
  supabase: SupabaseClient,
  budgetVersionId: string,
  level: PlanningRollupLevel = "client",
  analyticsFilters: AnalyticsQueryFilters = {}
): Promise<BudgetVarianceResult> {
  const cacheKey = buildPlanningCacheKey("variance", {
    versionId: budgetVersionId,
    level,
    billing: analyticsFilters.billingFilter,
  });

  return withPlanningCache(cacheKey, async () => {
    const [budgetRollups, snapshot] = await Promise.all([
      loadBudgetRollups(supabase, budgetVersionId, level, analyticsFilters),
      loadAnalyticsFacts(supabase, analyticsFilters),
    ]);

    rollupFacts(snapshot.facts, analyticsLevelForPlanning(level), analyticsFilters);

    const factsByKey = new Map<string, typeof snapshot.facts>();
    for (const fact of snapshot.facts) {
      let key = "global";
      switch (level) {
        case "campaign":
          key = fact.campaign_header_id;
          break;
        case "client":
          key = fact.client_id;
          break;
        case "brand":
          key = fact.brand_id ?? "unassigned";
          break;
        case "country":
          key = (fact.country_code ?? "unknown").toUpperCase();
          break;
        case "team":
          key = fact.team_id ?? "unassigned";
          break;
        case "business_unit":
          key = "global";
          break;
        default:
          key = "global";
      }
      const list = factsByKey.get(key) ?? [];
      list.push(fact);
      factsByKey.set(key, list);
    }

    const variances: VarianceAnalysis[] = budgetRollups.nodes.map((budgetNode) => {
      const facts = factsByKey.get(budgetNode.key) ?? [];
      const actual = mergeActualFromFacts(facts);
      return varianceFromBudgetAndActualRollups(budgetNode, actual, facts);
    });

    const globalBudget = budgetRollups.global;
    const globalActual = mergeActualFromFacts(snapshot.facts);
    const global = varianceFromBudgetAndActualRollups(
      globalBudget,
      globalActual,
      snapshot.facts
    );

    if (process.env.NODE_ENV === "development") {
      devLog("[planning-query] loadBudgetVariance", {
        versionId: budgetVersionId,
        level,
        slices: variances.length,
      });
    }

    return { level, variances, global };
  });
}
