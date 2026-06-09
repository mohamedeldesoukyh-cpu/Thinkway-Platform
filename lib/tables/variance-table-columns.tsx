"use client";

import type { OperationalConfigurableColumnDef } from "@/components/tables/operational-configurable-table";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { VarianceAnalysis } from "@/lib/planning/types/variance";
import { cn } from "@/lib/utils";

export type VarianceMetric = keyof Pick<
  VarianceAnalysis["variance_amount"],
  "revenue" | "gp" | "collections"
>;

export function buildVarianceTableColumns(
  metric: VarianceMetric = "revenue"
): OperationalConfigurableColumnDef<VarianceAnalysis>[] {
  return [
    {
      id: "entity",
      label: "Entity",
      renderCell: (row) => (
        <span className="max-w-[180px] truncate">{row.label}</span>
      ),
    },
    {
      id: "budget",
      label: "Budget",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) =>
        formatAnalyticsAmount(row.budget.revenue_budget, row.currency, { decimals: 0 }),
    },
    {
      id: "actual",
      label: "Actual",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) =>
        formatAnalyticsAmount(row.actual.revenue, row.currency, { decimals: 0 }),
    },
    {
      id: "variance",
      label: "Variance",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => {
        const amount = row.variance_amount[metric];
        return (
          <span
            className={cn(
              amount > 0 && "text-emerald-700 dark:text-emerald-300",
              amount < 0 && "text-red-600 dark:text-red-400"
            )}
          >
            {formatAnalyticsAmount(amount, row.currency, { decimals: 0 })}
          </span>
        );
      },
    },
    {
      id: "percent",
      label: "%",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => {
        const pct = row.variance_percent[metric as keyof VarianceAnalysis["variance_percent"]];
        return pct != null ? `${pct.toFixed(1)}%` : "—";
      },
    },
  ];
}
