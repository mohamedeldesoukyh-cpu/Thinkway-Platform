"use client";

import type { ReactNode } from "react";

import type { OperationalConfigurableColumnDef } from "@/components/tables/operational-configurable-table";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { AnalyticsRollupNode } from "@/lib/analytics/types/metrics";
import { cn } from "@/lib/utils";

export type ProfitabilitySortKey = "label" | "revenue" | "gp" | "margin";

export function buildProfitabilityTableColumns({
  sortKey,
  asc,
  onToggleSort,
  SortHead,
}: {
  sortKey: ProfitabilitySortKey;
  asc: boolean;
  onToggleSort: (key: ProfitabilitySortKey) => void;
  SortHead: (props: {
    label: string;
    active: boolean;
    asc: boolean;
    onClick: () => void;
    className?: string;
  }) => ReactNode;
}): OperationalConfigurableColumnDef<AnalyticsRollupNode>[] {
  const formatAmount = (node: AnalyticsRollupNode, value: number) =>
    formatAnalyticsAmount(value, node.currency, { decimals: 0 });

  return [
    {
      id: "name",
      label: "Name",
      renderHeader: () => (
        <SortHead
          label="Name"
          active={sortKey === "label"}
          asc={asc}
          onClick={() => onToggleSort("label")}
        />
      ),
      renderCell: (row) => row.label,
    },
    {
      id: "revenue",
      label: "Revenue",
      headerClassName: "text-right",
      amountCell: true,
      renderHeader: () => (
        <SortHead
          label="Revenue"
          active={sortKey === "revenue"}
          asc={asc}
          onClick={() => onToggleSort("revenue")}
          className="justify-end"
        />
      ),
      renderCell: (row) => formatAmount(row, row.metrics.revenue),
    },
    {
      id: "gp",
      label: "GP",
      headerClassName: "text-right",
      amountCell: true,
      renderHeader: () => (
        <SortHead
          label="GP"
          active={sortKey === "gp"}
          asc={asc}
          onClick={() => onToggleSort("gp")}
          className="justify-end"
        />
      ),
      renderCell: (row) => formatAmount(row, row.metrics.gp),
    },
    {
      id: "margin",
      label: "Margin",
      headerClassName: "text-right",
      amountCell: true,
      renderHeader: () => (
        <SortHead
          label="Margin"
          active={sortKey === "margin"}
          asc={asc}
          onClick={() => onToggleSort("margin")}
          className="justify-end"
        />
      ),
      renderCell: (row) => (
        <span
          className={cn(
            row.metrics.margin_percent < 15 && "text-amber-700 dark:text-amber-300"
          )}
        >
          {row.metrics.margin_percent.toFixed(1)}%
        </span>
      ),
    },
  ];
}
