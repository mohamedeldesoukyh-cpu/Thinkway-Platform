"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyTableFilters,
  applyTableSort,
  buildFilterTypes,
  type FilterableColumnDef,
  type TableFiltersState,
  type TableSortState,
  operationalTableFiltersStorageKey,
  operationalTableSortStorageKey,
} from "@/lib/tables/operational-table-filter-sort";

export function useOperationalTableFilterSort<T>(
  tableId: string,
  columns: readonly FilterableColumnDef<T>[],
  rows: readonly T[]
) {
  const [filters, setFilters] = useState<TableFiltersState>({});
  const [sort, setSort] = useState<TableSortState>(null);
  const [hydrated, setHydrated] = useState(false);

  const filterStorageKey = operationalTableFiltersStorageKey(tableId);
  const sortStorageKey = operationalTableSortStorageKey(tableId);

  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem(filterStorageKey);
      if (savedFilters) {
        setFilters(JSON.parse(savedFilters) as TableFiltersState);
      }
      const savedSort = localStorage.getItem(sortStorageKey);
      if (savedSort) {
        setSort(JSON.parse(savedSort) as TableSortState);
      }
    } catch {
      setFilters({});
      setSort(null);
    }
    setHydrated(true);
  }, [filterStorageKey, sortStorageKey]);

  const filterTypes = useMemo(
    () => buildFilterTypes(rows, columns),
    [rows, columns]
  );

  const processedRows = useMemo(() => {
    const filtered = applyTableFilters(rows, columns, filters, filterTypes);
    return applyTableSort(filtered, columns, sort);
  }, [rows, columns, filters, filterTypes, sort]);

  const persistFilters = useCallback(
    (next: TableFiltersState) => {
      setFilters(next);
      try {
        localStorage.setItem(filterStorageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [filterStorageKey]
  );

  const persistSort = useCallback(
    (next: TableSortState) => {
      setSort(next);
      try {
        if (next) {
          localStorage.setItem(sortStorageKey, JSON.stringify(next));
        } else {
          localStorage.removeItem(sortStorageKey);
        }
      } catch {
        /* ignore */
      }
    },
    [sortStorageKey]
  );

  const setColumnFilter = useCallback(
    (columnId: string, value: TableFiltersState[string]) => {
      persistFilters({ ...filters, [columnId]: value });
    },
    [filters, persistFilters]
  );

  const clearFilters = useCallback(() => {
    persistFilters({});
  }, [persistFilters]);

  const setTableSort = useCallback(
    (columnId: string) => {
      if (sort?.columnId === columnId) {
        if (sort.direction === "asc") {
          persistSort({ columnId, direction: "desc" });
          return;
        }
        persistSort(null);
        return;
      }
      persistSort({ columnId, direction: "asc" });
    },
    [persistSort, sort]
  );

  const clearSort = useCallback(() => {
    persistSort(null);
  }, [persistSort]);

  return {
    filters,
    sort,
    filterTypes,
    processedRows,
    setColumnFilter,
    clearFilters,
    setTableSort,
    clearSort,
    hydrated,
  };
}
