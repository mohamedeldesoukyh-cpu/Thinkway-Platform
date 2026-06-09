"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildDefaultTableColumnState,
  getVisibleOrderedColumnIds,
  normalizeTableColumnState,
  operationalTableColumnsStorageKey,
  reorderTableColumns,
  type OperationalTableColumnMeta,
  type OperationalTableColumnState,
} from "@/lib/tables/operational-table-column-settings";

export function useOperationalTableColumns(
  tableId: string,
  columns: readonly OperationalTableColumnMeta[]
) {
  const defaultState = useMemo(() => buildDefaultTableColumnState(columns), [columns]);
  const [state, setState] = useState<OperationalTableColumnState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  const storageKey = operationalTableColumnsStorageKey(tableId);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setState(normalizeTableColumnState(JSON.parse(raw), columns));
      }
    } catch {
      setState(defaultState);
    }
    setHydrated(true);
  }, [storageKey, columns, defaultState]);

  const persistState = useCallback(
    (next: OperationalTableColumnState) => {
      const normalized = normalizeTableColumnState(next, columns);
      setState(normalized);
      try {
        localStorage.setItem(storageKey, JSON.stringify(normalized));
      } catch {
        /* ignore quota / private mode */
      }
    },
    [columns, storageKey]
  );

  const toggleColumnVisibility = useCallback(
    (columnId: string, visible: boolean) => {
      const column = columns.find((item) => item.id === columnId);
      if (!column || column.locked) {
        return;
      }

      const nextVisible = { ...state.visible, [columnId]: visible };
      const visibleCount = state.order.filter((id) => nextVisible[id] !== false).length;
      if (!visible && visibleCount === 0) {
        return;
      }

      persistState({ ...state, visible: nextVisible });
    },
    [columns, persistState, state]
  );

  const moveColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      persistState({
        ...state,
        order: reorderTableColumns(state.order, fromIndex, toIndex),
      });
    },
    [persistState, state]
  );

  const resetToDefault = useCallback(() => {
    persistState(defaultState);
  }, [defaultState, persistState]);

  const orderedColumns = useMemo(() => {
    const metaById = new Map(columns.map((column) => [column.id, column]));
    return state.order
      .map((id) => metaById.get(id))
      .filter((column): column is OperationalTableColumnMeta => Boolean(column));
  }, [columns, state.order]);

  const visibleOrderedColumnIds = useMemo(
    () => getVisibleOrderedColumnIds(columns, state),
    [columns, state]
  );

  return {
    state,
    orderedColumns,
    visibleOrderedColumnIds,
    toggleColumnVisibility,
    moveColumn,
    resetToDefault,
    hydrated,
  };
}
