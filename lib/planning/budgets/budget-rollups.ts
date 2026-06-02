import { buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { devLog } from "@/lib/dev-log";
import {
  emptyBudgetFinancialFields,
  mergeBudgetFinancialFields,
  normalizeBudgetLineRow,
} from "@/lib/planning/budgets/budget-amounts";
import type { BudgetFinancialFields, BudgetLine } from "@/lib/planning/types/budget";
import type {
  PlanningDimension,
  PlanningRollupLevel,
} from "@/lib/planning/types/dimensions";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";

export type BudgetRollupInput = PlanningDimension &
  BudgetFinancialFields & {
    currency_code: string;
    label?: string;
  };

export type BudgetRollupNode = {
  level: PlanningRollupLevel;
  key: string;
  label: string;
  currency: AnalyticsCurrencyContext;
  metrics: BudgetFinancialFields;
  line_count: number;
};

function rollupKeyForLine(
  line: BudgetRollupInput,
  level: PlanningRollupLevel
): { key: string; label: string } {
  switch (level) {
    case "campaign":
      return {
        key: line.campaign_header_id ?? "unassigned",
        label: line.label ?? "Unassigned campaign",
      };
    case "client":
      return {
        key: line.client_id ?? "unassigned",
        label: line.label ?? "Unassigned client",
      };
    case "brand":
      return {
        key: line.brand_id ?? "unassigned",
        label: line.label ?? "Unassigned brand",
      };
    case "country":
      return {
        key: (line.country_code ?? "unknown").toUpperCase(),
        label: line.country_code ?? "Unknown",
      };
    case "team":
      return {
        key: line.team_id ?? "unassigned",
        label: line.label ?? "Unassigned team",
      };
    case "business_unit":
      return {
        key: line.business_unit_id ?? "unassigned",
        label: line.label ?? "Unassigned business unit",
      };
    case "global":
      return { key: "global", label: "Global" };
    default:
      return { key: "global", label: "Global" };
  }
}

export function budgetLineToRollupInput(
  line: BudgetLine,
  labels?: Partial<Record<string, string>>
): BudgetRollupInput {
  return {
    ...line,
    label:
      labels?.campaign ??
      labels?.client ??
      labels?.brand ??
      labels?.team ??
      labels?.business_unit,
  };
}

export function rollupBudgetLines(
  lines: BudgetRollupInput[],
  level: PlanningRollupLevel
): BudgetRollupNode[] {
  const groups = new Map<
    string,
    {
      meta: { key: string; label: string };
      metrics: BudgetFinancialFields;
      currencies: string[];
      count: number;
    }
  >();

  for (const line of lines) {
    const meta = rollupKeyForLine(line, level);
    const bucket =
      groups.get(meta.key) ??
      {
        meta,
        metrics: emptyBudgetFinancialFields(),
        currencies: [],
        count: 0,
      };

    bucket.metrics = mergeBudgetFinancialFields(
      bucket.metrics,
      normalizeBudgetLineRow(line)
    );
    bucket.currencies.push(line.currency_code);
    bucket.count += 1;
    groups.set(meta.key, bucket);
  }

  const nodes: BudgetRollupNode[] = [...groups.values()]
    .map((group) => ({
      level,
      key: group.meta.key,
      label: group.meta.label,
      currency: buildCurrencyContext(group.currencies, {
        preserveCampaignCurrency: true,
      }),
      metrics: group.metrics,
      line_count: group.count,
    }))
    .sort((a, b) => b.metrics.revenue_budget - a.metrics.revenue_budget);

  if (process.env.NODE_ENV === "development") {
    devLog("[budget-rollup] computed budget rollup", {
      level,
      lineCount: lines.length,
      nodeCount: nodes.length,
    });
  }

  return nodes;
}

export function rollupBudgetGlobal(lines: BudgetRollupInput[]): BudgetRollupNode {
  const nodes = rollupBudgetLines(lines, "global");
  return (
    nodes[0] ?? {
      level: "global",
      key: "global",
      label: "Global",
      currency: buildCurrencyContext([]),
      metrics: emptyBudgetFinancialFields(),
      line_count: 0,
    }
  );
}
