"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";

import { useOperationalTableColumns } from "@/hooks/use-operational-table-columns";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";

type OperationalTableColumnsContextValue = ReturnType<typeof useOperationalTableColumns>;

const OperationalTableColumnsContext =
  createContext<OperationalTableColumnsContextValue | null>(null);

const OperationalTableChildColumnsContext =
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

/** Parent + child column settings with separate localStorage persistence. */
export function OperationalTableDualColumnsProvider({
  parentTableId,
  parentColumns,
  childTableId,
  childColumns,
  children,
}: {
  parentTableId: string;
  parentColumns: readonly OperationalTableColumnMeta[];
  childTableId: string;
  childColumns: readonly OperationalTableColumnMeta[];
  children: ReactNode;
}) {
  const parent = useOperationalTableColumns(parentTableId, parentColumns);
  const child = useOperationalTableColumns(childTableId, childColumns);

  return (
    <OperationalTableColumnsContext.Provider value={parent}>
      <OperationalTableChildColumnsContext.Provider value={child}>
        {children}
      </OperationalTableChildColumnsContext.Provider>
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

export function useOperationalTableChildColumnsContext() {
  const context = useContext(OperationalTableChildColumnsContext);
  if (!context) {
    throw new Error(
      "useOperationalTableChildColumnsContext must be used within OperationalTableDualColumnsProvider"
    );
  }
  return context;
}

export function useOperationalTableChildColumnsContextOptional() {
  return useContext(OperationalTableChildColumnsContext);
}

export function useIsOperationalColumnVisible(columnId: string) {
  const { state, hydrated } = useOperationalTableColumnsContext();
  if (!hydrated) {
    return true;
  }
  return state.visible[columnId] !== false;
}

/** Pure checker for use in useMemo / layout helpers — hooks run once at top level. */
export function useOperationalColumnVisibleChecker() {
  const { state, hydrated } = useOperationalTableColumnsContext();
  return useCallback(
    (columnId: string) => {
      if (!hydrated) {
        return true;
      }
      return state.visible[columnId] !== false;
    },
    [state, hydrated]
  );
}

/** @alias useOperationalColumnVisibleChecker */
export const useOperationalColumnVisibilityChecker = useOperationalColumnVisibleChecker;

export function useIsOperationalChildColumnVisible(columnId: string) {
  const context = useOperationalTableChildColumnsContextOptional();
  if (!context || !context.hydrated) {
    return true;
  }
  return context.state.visible[columnId] !== false;
}

/** Pure checker for child columns — safe inside useMemo and filters. */
export function useOperationalChildColumnVisibleChecker() {
  const context = useOperationalTableChildColumnsContextOptional();
  return useCallback(
    (columnId: string) => {
      if (!context || !context.hydrated) {
        return true;
      }
      return context.state.visible[columnId] !== false;
    },
    [context]
  );
}

/** @alias useOperationalChildColumnVisibleChecker */
export const useOperationalChildColumnVisibilityChecker =
  useOperationalChildColumnVisibleChecker;

export function useOperationalVisibleColumnCount() {
  const { visibleOrderedColumnIds } = useOperationalTableColumnsContext();
  return visibleOrderedColumnIds.length;
}

export function useOperationalChildVisibleColumnCount() {
  const context = useOperationalTableChildColumnsContextOptional();
  if (!context) {
    return 0;
  }
  return context.visibleOrderedColumnIds.length;
}
