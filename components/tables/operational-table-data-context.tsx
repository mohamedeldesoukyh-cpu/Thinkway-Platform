"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useOperationalTableFilterSort } from "@/hooks/use-operational-table-filter-sort";
import {
  mergeFilterAccessors,
  toFilterableField,
  type FilterableColumnDef,
  type FilterableValue,
  type OperationalTableFilterField,
} from "@/lib/tables/operational-table-filter-sort";

type OperationalTableDataContextValue<T> = ReturnType<
  typeof useOperationalTableFilterSort<T>
> & {
  columns: readonly FilterableColumnDef<T>[];
  filterColumns: readonly FilterableColumnDef<T>[];
  sourceRows: readonly T[];
};

const OperationalTableDataContext =
  createContext<OperationalTableDataContextValue<unknown> | null>(null);

export function OperationalTableDataProvider<T>({
  tableId,
  columns,
  rows,
  filterAccessors,
  additionalFilterFields,
  children,
}: {
  tableId: string;
  columns: readonly FilterableColumnDef<T>[];
  rows: readonly T[];
  filterAccessors?: Partial<Record<string, (row: T) => FilterableValue>>;
  additionalFilterFields?: readonly OperationalTableFilterField<T>[];
  children: ReactNode;
}) {
  const mergedColumns = mergeFilterAccessors(columns, filterAccessors);
  const filterColumns = [
    ...mergedColumns,
    ...(additionalFilterFields ?? []).map(toFilterableField),
  ];
  const value = useOperationalTableFilterSort(tableId, filterColumns, rows);

  return (
    <OperationalTableDataContext.Provider
      value={
        {
          ...value,
          columns: mergedColumns,
          filterColumns,
          sourceRows: rows,
        } as OperationalTableDataContextValue<unknown>
      }
    >
      {children}
    </OperationalTableDataContext.Provider>
  );
}

export function useOperationalTableDataContext<T>() {
  const context = useContext(OperationalTableDataContext);
  if (!context) {
    throw new Error(
      "useOperationalTableDataContext must be used within OperationalTableDataProvider"
    );
  }
  return context as OperationalTableDataContextValue<T>;
}

export function useOperationalTableDataContextOptional<T>() {
  const context = useContext(OperationalTableDataContext);
  return context as OperationalTableDataContextValue<T> | null;
}
