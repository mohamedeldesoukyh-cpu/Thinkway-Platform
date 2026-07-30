"use client";

import { useEffect } from "react";

import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import {
  buildListNavFilterKey,
  writeListNavContext,
  type ListNavEntity,
} from "@/lib/navigation/list-nav-context";

type ListNavSyncProps<T> = {
  entity: ListNavEntity;
  rows: readonly T[];
  rowId: (row: T) => string;
  /** Extra fingerprint parts (e.g. server search). */
  filterParts?: Record<string, unknown>;
};

/**
 * Keeps sessionStorage list-nav context aligned with the current filtered table rows.
 */
export function ListNavSync<T>({
  entity,
  rows,
  rowId,
  filterParts = {},
}: ListNavSyncProps<T>) {
  const dataContext = useOperationalTableDataContextOptional<T>();
  const processed = dataContext?.processedRows ?? rows;
  const filterFingerprint = buildListNavFilterKey(filterParts);

  useEffect(() => {
    const ids = processed.map(rowId);
    writeListNavContext(entity, {
      ids,
      filterKey: buildListNavFilterKey({
        base: filterFingerprint,
        count: ids.length,
      }),
    });
  }, [entity, filterFingerprint, processed, rowId]);

  return null;
}
