"use client";

import type { ReactNode } from "react";

import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControls } from "@/components/tables/operational-table-controls";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import type { FilterableValue } from "@/lib/tables/operational-table-filter-sort";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { cn } from "@/lib/utils";

type OperationalDataTableProps<T> = {
  tableId: string;
  contextLabel: string;
  columns: readonly OperationalConfigurableColumnDef<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  emptyMessage?: ReactNode;
  /** When true, wraps with provider only — settings must be rendered by parent. */
  providerOnly?: boolean;
  /** Renders settings above the table inside the provider. */
  showSettings?: boolean;
  columnMetas?: readonly OperationalTableColumnMeta[];
  filterAccessors?: Partial<Record<string, (row: T) => FilterableValue>>;
};

export function OperationalDataTable<T>({
  tableId,
  contextLabel,
  columns,
  rows,
  rowKey,
  className,
  rowClassName,
  emptyMessage,
  providerOnly = false,
  showSettings = false,
  columnMetas,
  filterAccessors,
}: OperationalDataTableProps<T>) {
  void columnMetas;

  const content =
    rows.length === 0 && emptyMessage ? (
      typeof emptyMessage === "string" ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">{emptyMessage}</p>
      ) : (
        emptyMessage
      )
    ) : (
      <OperationalConfigurableTable
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        className={className}
        rowClassName={rowClassName}
      />
    );

  return (
    <OperationalTableSuiteProvider
      tableId={tableId}
      columns={columns}
      rows={rows}
      filterAccessors={filterAccessors}
    >
      {showSettings ? (
        <div className="flex justify-end border-b border-border/40 px-4 py-2">
          <OperationalTableControls contextLabel={contextLabel} />
        </div>
      ) : null}
      {providerOnly ? content : content}
    </OperationalTableSuiteProvider>
  );
}

/** @deprecated Use OperationalTableControlsSlot */
export function OperationalTableSettingsSlot({
  contextLabel,
  className,
  columnSettings = "default",
}: {
  contextLabel: string;
  className?: string;
  columnSettings?: "default" | "assignment-grid";
}) {
  return (
    <OperationalTableControlsSlot
      contextLabel={contextLabel}
      className={className}
      columnSettings={columnSettings}
    />
  );
}

export function OperationalTableControlsSlot({
  contextLabel,
  className,
  showFilter = true,
  showSort = true,
  showSettings = true,
  columnSettings = "default",
}: {
  contextLabel: string;
  className?: string;
  showFilter?: boolean;
  showSort?: boolean;
  showSettings?: boolean;
  columnSettings?: "default" | "assignment-grid";
}) {
  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      <OperationalTableControls
        contextLabel={contextLabel}
        showFilter={showFilter}
        showSort={showSort}
        showSettings={showSettings}
        columnSettings={columnSettings}
      />
    </div>
  );
}
