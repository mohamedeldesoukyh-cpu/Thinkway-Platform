"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { BudgetRollupNode } from "@/lib/planning/budgets/budget-rollups";
import type { VarianceAnalysis } from "@/lib/planning/types/variance";
import { cn } from "@/lib/utils";

type BudgetDrilldownTreeProps = {
  rollups: BudgetRollupNode[];
  variances?: VarianceAnalysis[];
};

type DrillRow = {
  key: string;
  label: string;
  level: number;
  budget: number;
  actual: number;
  forecast: number;
  variance: number;
  variancePct: number;
  currency: BudgetRollupNode["currency"];
  children: DrillRow[];
};

function buildTree(
  rollups: BudgetRollupNode[],
  varianceMap: Map<string, VarianceAnalysis>
): DrillRow[] {
  return rollups.map((node) => {
    const v = varianceMap.get(node.key);
    const budget = node.metrics.revenue_budget;
    const actual = v?.actual.revenue ?? 0;
    const forecast = node.metrics.revenue_budget;
    const variance = v?.variance_amount.revenue ?? budget - actual;
    const variancePct = v?.variance_percent.revenue ?? 0;

    return {
      key: node.key,
      label: node.label,
      level: 0,
      budget,
      actual,
      forecast,
      variance,
      variancePct,
      currency: node.currency,
      children: [],
    };
  });
}

function DrilldownNode({ row, depth }: { row: DrillRow; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = row.children.length > 0;
  const format = (n: number) =>
    formatAnalyticsAmount(n, row.currency, { decimals: 0 });

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => hasChildren && setOpen((o) => !o)}
        disabled={!hasChildren}
      >
        {hasChildren ? (
          open ? (
            <ChevronDownIcon className="size-4 shrink-0" />
          ) : (
            <ChevronRightIcon className="size-4 shrink-0" />
          )
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
        <span className="hidden font-mono text-xs sm:inline">{format(row.budget)}</span>
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
          {format(row.actual)}
        </span>
        <span className="hidden font-mono text-xs sm:inline">{format(row.forecast)}</span>
        <span
          className={cn(
            "font-mono text-xs",
            row.variance >= 0 ? "text-emerald-600" : "text-red-600"
          )}
        >
          {format(row.variance)}
        </span>
        <span className="w-12 text-right text-xs">{row.variancePct.toFixed(1)}%</span>
      </button>
      {open && hasChildren
        ? row.children.map((child) => (
            <DrilldownNode key={child.key} row={child} depth={depth + 1} />
          ))
        : null}
    </div>
  );
}

export function BudgetDrilldownTree({ rollups, variances = [] }: BudgetDrilldownTreeProps) {
  const rows = useMemo(() => {
    const map = new Map(variances.map((v) => [v.key, v]));
    return buildTree(rollups, map);
  }, [rollups, variances]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No drilldown data. Select a budget version with dimensional lines.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-border">
      <div className="flex border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span className="flex-1">Dimension</span>
        <span className="hidden w-20 text-right sm:block">Budget</span>
        <span className="hidden w-20 text-right sm:block">Actual</span>
        <span className="hidden w-20 text-right sm:block">Forecast</span>
        <span className="w-20 text-right">Variance</span>
        <span className="w-12 text-right">%</span>
      </div>
      {rows.map((row) => (
        <DrilldownNode key={row.key} row={row} depth={0} />
      ))}
      <p className="px-3 py-2 text-[10px] text-muted-foreground">
        Global → Country → Client → Brand → Campaign → Team (expand via filters and lines).
      </p>
    </div>
  );
}
