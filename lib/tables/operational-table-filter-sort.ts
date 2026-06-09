import type { OperationalConfigurableColumnDef } from "@/components/tables/operational-configurable-table";

export const BLANK_FILTER_VALUE = "__BLANK__";

export type OperationalTableFilterType = "text" | "date" | "number" | "enum" | "boolean";

export type TextColumnFilter = { type: "text"; query: string };
export type DateColumnFilter = { type: "date"; from: string; to: string };
export type NumberColumnFilter = { type: "number"; from: string; to: string };
export type EnumColumnFilter = { type: "enum"; values: string[] };
export type BooleanColumnFilter = { type: "boolean"; value: boolean | null };

export type ColumnFilterValue =
  | TextColumnFilter
  | DateColumnFilter
  | NumberColumnFilter
  | EnumColumnFilter
  | BooleanColumnFilter;

export type TableFiltersState = Record<string, ColumnFilterValue | undefined>;

export type TableSortState = {
  columnId: string;
  direction: "asc" | "desc";
} | null;

export type FilterableValue = string | number | boolean | null | undefined;

export type FilterableColumnDef<T> = OperationalConfigurableColumnDef<T> & {
  filterType?: OperationalTableFilterType;
  filterable?: boolean;
  sortable?: boolean;
  filterAccessor?: (row: T) => FilterableValue;
  getFilterValue?: (row: T) => FilterableValue;
  getSortValue?: (row: T) => string | number | null | undefined;
};

/** Filter-only field (not rendered as a table column). */
export type OperationalTableFilterField<T> = {
  id: string;
  label: string;
  filterType?: OperationalTableFilterType;
  filterAccessor: (row: T) => FilterableValue;
};

export function toFilterableField<T>(
  field: OperationalTableFilterField<T>
): FilterableColumnDef<T> {
  return {
    id: field.id,
    label: field.label,
    filterType: field.filterType,
    filterAccessor: field.filterAccessor,
    renderCell: () => null,
    filterable: true,
    sortable: false,
    defaultVisible: false,
  };
}

export function operationalTableFiltersStorageKey(tableId: string) {
  return `thinkway:table-filters:${tableId}:v1`;
}

export function operationalTableSortStorageKey(tableId: string) {
  return `thinkway:table-sort:${tableId}:v1`;
}

export function mergeFilterAccessors<T>(
  columns: readonly FilterableColumnDef<T>[],
  accessors?: Partial<Record<string, (row: T) => FilterableValue>>
): FilterableColumnDef<T>[] {
  if (!accessors) {
    return [...columns];
  }
  return columns.map((column) => ({
    ...column,
    filterAccessor: column.filterAccessor ?? accessors[column.id],
  }));
}

export function resolveColumnFilterValue<T>(
  column: FilterableColumnDef<T>,
  row: T
): FilterableValue {
  if (column.getFilterValue) {
    return column.getFilterValue(row);
  }
  if (column.filterAccessor) {
    return column.filterAccessor(row);
  }
  return null;
}

export function resolveColumnSortValue<T>(
  column: FilterableColumnDef<T>,
  row: T
): string | number | null {
  const sortValue = column.getSortValue?.(row);
  if (sortValue != null && sortValue !== "") {
    return sortValue;
  }
  const filterValue = resolveColumnFilterValue(column, row);
  if (filterValue == null || filterValue === "") {
    return null;
  }
  if (typeof filterValue === "number") {
    return filterValue;
  }
  if (typeof filterValue === "boolean") {
    return filterValue ? 1 : 0;
  }
  return String(filterValue);
}

export function isColumnFilterable<T>(column: FilterableColumnDef<T>): boolean {
  if (column.locked || column.filterable === false) {
    return false;
  }
  return Boolean(column.getFilterValue || column.filterAccessor);
}

export function isColumnSortable<T>(column: FilterableColumnDef<T>): boolean {
  if (column.locked || column.sortable === false) {
    return false;
  }
  return Boolean(
    column.getSortValue || column.getFilterValue || column.filterAccessor
  );
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) || !Number.isNaN(Date.parse(value));
}

export function inferFilterType<T>(
  column: FilterableColumnDef<T>,
  sampleValues: FilterableValue[]
): OperationalTableFilterType {
  if (column.filterType) {
    return column.filterType;
  }
  if (column.amountCell) {
    return "number";
  }

  const normalized = sampleValues
    .filter((value) => value != null && value !== "")
    .map((value) => (typeof value === "boolean" ? String(value) : value));

  if (normalized.length === 0) {
    return "text";
  }

  if (normalized.every((value) => typeof value === "number")) {
    return "number";
  }

  if (normalized.every((value) => typeof value === "string" && isIsoDateString(value))) {
    return "date";
  }

  const unique = new Set(normalized.map((value) => String(value)));
  if (unique.size <= 30) {
    return "enum";
  }

  return "text";
}

export function deriveEnumOptions<T>(
  rows: readonly T[],
  column: FilterableColumnDef<T>
): string[] {
  const values = new Set<string>();
  let hasBlank = false;

  for (const row of rows) {
    const raw = resolveColumnFilterValue(column, row);
    if (raw == null || raw === "") {
      hasBlank = true;
      continue;
    }
    values.add(String(raw));
  }

  const sorted = [...values].sort((a, b) => a.localeCompare(b));
  if (hasBlank) {
    sorted.unshift(BLANK_FILTER_VALUE);
  }
  return sorted;
}

function normalizeText(value: FilterableValue): string {
  if (value == null) {
    return "";
  }
  return String(value).toLowerCase();
}

function parseNumberInput(value: string): number | null {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function rowMatchesFilter<T>(
  row: T,
  column: FilterableColumnDef<T>,
  filter: ColumnFilterValue,
  filterType: OperationalTableFilterType
): boolean {
  const raw = resolveColumnFilterValue(column, row);

  switch (filterType) {
    case "text": {
      const query = filter.type === "text" ? filter.query.trim().toLowerCase() : "";
      if (!query) {
        return true;
      }
      return normalizeText(raw).includes(query);
    }
    case "boolean": {
      if (filter.type !== "boolean" || filter.value === null) {
        return true;
      }
      return Boolean(raw) === filter.value;
    }
    case "number": {
      if (filter.type !== "number") {
        return true;
      }
      const numeric =
        typeof raw === "number" ? raw : raw == null || raw === "" ? null : Number(raw);
      if (numeric == null || !Number.isFinite(numeric)) {
        return false;
      }
      const from = parseNumberInput(filter.from);
      const to = parseNumberInput(filter.to);
      if (from != null && numeric < from) {
        return false;
      }
      if (to != null && numeric > to) {
        return false;
      }
      return true;
    }
    case "date": {
      if (filter.type !== "date") {
        return true;
      }
      const value = raw == null || raw === "" ? null : String(raw).slice(0, 10);
      if (!value) {
        return false;
      }
      if (filter.from && value < filter.from) {
        return false;
      }
      if (filter.to && value > filter.to) {
        return false;
      }
      return true;
    }
    case "enum": {
      if (filter.type !== "enum" || filter.values.length === 0) {
        return true;
      }
      const isBlank = raw == null || raw === "";
      const key = isBlank ? BLANK_FILTER_VALUE : String(raw);
      return filter.values.includes(key);
    }
    default:
      return true;
  }
}

export function applyTableFilters<T>(
  rows: readonly T[],
  columns: readonly FilterableColumnDef<T>[],
  filters: TableFiltersState,
  filterTypes: Record<string, OperationalTableFilterType>
): T[] {
  const activeColumns = columns.filter((column) => {
    const filter = filters[column.id];
    if (!filter) {
      return false;
    }
    if (filter.type === "text" && !filter.query.trim()) {
      return false;
    }
    if (filter.type === "enum" && filter.values.length === 0) {
      return false;
    }
    if (filter.type === "date" && !filter.from && !filter.to) {
      return false;
    }
    if (filter.type === "number" && !filter.from && !filter.to) {
      return false;
    }
    if (filter.type === "boolean" && filter.value === null) {
      return false;
    }
    return true;
  });

  if (activeColumns.length === 0) {
    return [...rows];
  }

  return rows.filter((row) =>
    activeColumns.every((column) => {
      const filter = filters[column.id];
      if (!filter) {
        return true;
      }
      return rowMatchesFilter(row, column, filter, filterTypes[column.id] ?? "text");
    })
  );
}

function compareSortValues(
  a: string | number | null,
  b: string | number | null,
  direction: "asc" | "desc"
): number {
  const emptyA = a == null || a === "";
  const emptyB = b == null || b === "";
  if (emptyA && emptyB) {
    return 0;
  }
  if (emptyA) {
    return 1;
  }
  if (emptyB) {
    return -1;
  }

  let result = 0;
  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b), undefined, { numeric: true });
  }

  return direction === "asc" ? result : -result;
}

export function applyTableSort<T>(
  rows: readonly T[],
  columns: readonly FilterableColumnDef<T>[],
  sort: TableSortState
): T[] {
  if (!sort) {
    return [...rows];
  }

  const column = columns.find((item) => item.id === sort.columnId);
  if (!column) {
    return [...rows];
  }

  const copy = [...rows];
  copy.sort((left, right) =>
    compareSortValues(
      resolveColumnSortValue(column, left),
      resolveColumnSortValue(column, right),
      sort.direction
    )
  );
  return copy;
}

export function buildFilterTypes<T>(
  rows: readonly T[],
  columns: readonly FilterableColumnDef<T>[]
): Record<string, OperationalTableFilterType> {
  const result: Record<string, OperationalTableFilterType> = {};
  for (const column of columns) {
    if (!isColumnFilterable(column)) {
      continue;
    }
    const samples = rows
      .slice(0, 200)
      .map((row) => resolveColumnFilterValue(column, row));
    result[column.id] = inferFilterType(column, samples);
  }
  return result;
}

export function hasActiveFilters(filters: TableFiltersState): boolean {
  return Object.values(filters).some((filter) => {
    if (!filter) {
      return false;
    }
    if (filter.type === "text") {
      return Boolean(filter.query.trim());
    }
    if (filter.type === "enum") {
      return filter.values.length > 0;
    }
    if (filter.type === "date") {
      return Boolean(filter.from || filter.to);
    }
    if (filter.type === "number") {
      return Boolean(filter.from || filter.to);
    }
    if (filter.type === "boolean") {
      return filter.value !== null;
    }
    return false;
  });
}

export function createEmptyFilter(
  filterType: OperationalTableFilterType
): ColumnFilterValue {
  switch (filterType) {
    case "text":
      return { type: "text", query: "" };
    case "date":
      return { type: "date", from: "", to: "" };
    case "number":
      return { type: "number", from: "", to: "" };
    case "enum":
      return { type: "enum", values: [] };
    case "boolean":
      return { type: "boolean", value: null };
  }
}
