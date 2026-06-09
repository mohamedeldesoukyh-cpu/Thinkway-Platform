import type { OperationalConfigurableColumnDef } from "@/components/tables/operational-configurable-table";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import type { FilterableValue } from "@/lib/tables/operational-table-filter-sort";

const NON_DATA_COLUMN_IDS = new Set(["select", "actions"]);

/** Build full column defs from metas for filter/sort (custom tables with manual rendering). */
export function operationalColumnsFromMetas<T>(
  metas: readonly OperationalTableColumnMeta[],
  filterAccessors?: Partial<Record<string, (row: T) => FilterableValue>>
): OperationalConfigurableColumnDef<T>[] {
  return metas.map((meta) => ({
    id: meta.id,
    label: meta.label,
    defaultVisible: meta.defaultVisible,
    locked: meta.locked,
    renderCell: () => null,
    filterAccessor: filterAccessors?.[meta.id],
    filterable: !NON_DATA_COLUMN_IDS.has(meta.id),
    sortable: !NON_DATA_COLUMN_IDS.has(meta.id),
  }));
}
