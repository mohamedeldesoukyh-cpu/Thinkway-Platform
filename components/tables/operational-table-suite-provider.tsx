"use client";

import type { ReactNode } from "react";

import { OperationalTableColumnsProvider } from "@/components/tables/operational-table-column-context";
import { OperationalTableDataProvider } from "@/components/tables/operational-table-data-context";
import {
  getOperationalTableColumnMetas,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import type {
  FilterableValue,
  OperationalTableFilterField,
} from "@/lib/tables/operational-table-filter-sort";

type OperationalTableSuiteProviderProps<T> = {
  tableId: string;
  columns: readonly OperationalConfigurableColumnDef<T>[];
  rows: readonly T[];
  filterAccessors?: Partial<Record<string, (row: T) => FilterableValue>>;
  additionalFilterFields?: readonly OperationalTableFilterField<T>[];
  children: ReactNode;
};

/** Column settings + content-based filter/sort for operational tables. */
export function OperationalTableSuiteProvider<T>({
  tableId,
  columns,
  rows,
  filterAccessors,
  additionalFilterFields,
  children,
}: OperationalTableSuiteProviderProps<T>) {
  const columnMetas = getOperationalTableColumnMetas(columns);

  return (
    <OperationalTableColumnsProvider tableId={tableId} columns={columnMetas}>
      <OperationalTableDataProvider
        tableId={tableId}
        columns={columns}
        rows={rows}
        filterAccessors={filterAccessors}
        additionalFilterFields={additionalFilterFields}
      >
        {children}
      </OperationalTableDataProvider>
    </OperationalTableColumnsProvider>
  );
}
