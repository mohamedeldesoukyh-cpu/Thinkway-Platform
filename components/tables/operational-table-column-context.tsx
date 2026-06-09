"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useOperationalTableColumns } from "@/hooks/use-operational-table-columns";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";

type OperationalTableColumnsContextValue = ReturnType<typeof useOperationalTableColumns>;

const OperationalTableColumnsContext =
  createContext<OperationalTableColumnsContextValue | null>(null);

export function OperationalTableColumnsProvider({
  tableId,
  columns,
  children,
}: {
  tableId: string;
  columns: readonly OperationalTableColumnMeta[];
  children: ReactNode;
}) {
  const value = useOperationalTableColumns(tableId, columns);

  return (
    <OperationalTableColumnsContext.Provider value={value}>
      {children}
    </OperationalTableColumnsContext.Provider>
  );
}

export function useOperationalTableColumnsContext() {
  const context = useContext(OperationalTableColumnsContext);
  if (!context) {
    throw new Error(
      "useOperationalTableColumnsContext must be used within OperationalTableColumnsProvider"
    );
  }
  return context;
}

export function useIsOperationalColumnVisible(columnId: string) {
  const { state, hydrated } = useOperationalTableColumnsContext();
  if (!hydrated) {
    return true;
  }
  return state.visible[columnId] !== false;
}

export function useOperationalVisibleColumnCount() {
  const { visibleOrderedColumnIds } = useOperationalTableColumnsContext();
  return visibleOrderedColumnIds.length;
}
