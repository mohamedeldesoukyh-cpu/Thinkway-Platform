export type OperationalTableColumnMeta = {
  id: string;
  label: string;
  /** Defaults to true when omitted. */
  defaultVisible?: boolean;
  /** Always shown; cannot be hidden from settings. */
  locked?: boolean;
};

export type OperationalTableColumnState = {
  order: string[];
  visible: Record<string, boolean>;
};

export function operationalTableColumnsStorageKey(tableId: string) {
  return `thinkway:table-columns:${tableId}:v1`;
}

export function buildDefaultTableColumnState(
  columns: readonly OperationalTableColumnMeta[]
): OperationalTableColumnState {
  return {
    order: columns.map((column) => column.id),
    visible: Object.fromEntries(
      columns.map((column) => [column.id, column.defaultVisible !== false])
    ),
  };
}

/** Merge saved state with current column definitions. */
export function normalizeTableColumnState(
  saved: unknown,
  columns: readonly OperationalTableColumnMeta[]
): OperationalTableColumnState {
  const defaults = buildDefaultTableColumnState(columns);
  const columnIds = new Set(columns.map((column) => column.id));

  if (!saved || typeof saved !== "object") {
    return defaults;
  }

  const raw = saved as Partial<OperationalTableColumnState>;
  const parsedOrder = Array.isArray(raw.order)
    ? raw.order.filter((id): id is string => typeof id === "string" && columnIds.has(id))
    : [];

  const seen = new Set<string>();
  const order: string[] = [];

  for (const id of parsedOrder) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }

  for (const column of columns) {
    if (!seen.has(column.id)) {
      seen.add(column.id);
      order.push(column.id);
    }
  }

  const visible: Record<string, boolean> = { ...defaults.visible };

  if (raw.visible && typeof raw.visible === "object") {
    for (const column of columns) {
      const savedVisible = (raw.visible as Record<string, unknown>)[column.id];
      if (typeof savedVisible === "boolean") {
        visible[column.id] = column.locked ? true : savedVisible;
      }
    }
  }

  for (const column of columns) {
    if (column.locked) {
      visible[column.id] = true;
    }
  }

  const visibleCount = order.filter((id) => visible[id]).length;
  if (visibleCount === 0) {
    const firstUnlocked = columns.find((column) => !column.locked);
    if (firstUnlocked) {
      visible[firstUnlocked.id] = true;
    } else if (columns[0]) {
      visible[columns[0].id] = true;
    }
  }

  return { order, visible };
}

export function reorderTableColumns(
  order: readonly string[],
  fromIndex: number,
  toIndex: number
): string[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length
  ) {
    return [...order];
  }

  const next = [...order];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function getVisibleOrderedColumnIds(
  columns: readonly OperationalTableColumnMeta[],
  state: OperationalTableColumnState
): string[] {
  const metaById = new Map(columns.map((column) => [column.id, column]));

  return state.order.filter((id) => {
    const column = metaById.get(id);
    if (!column) {
      return false;
    }
    return column.locked || state.visible[id] !== false;
  });
}
