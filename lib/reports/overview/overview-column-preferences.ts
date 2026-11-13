import { DEFAULT_OVERVIEW_COLUMNS, OVERVIEW_COLUMNS, orderOverviewColumns, type OverviewColumn } from "./overview-report";

export const OVERVIEW_PREFERENCE_KEY = "overview_report_columns";
export type OverviewColumnPreferences = { columns: OverviewColumn[]; order: OverviewColumn[] };
export function normalizeOverviewColumnPreferences(value: unknown): OverviewColumnPreferences {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const valid = (items: unknown): OverviewColumn[] => Array.isArray(items)
    ? [...new Set(items)].filter((key): key is OverviewColumn => OVERVIEW_COLUMNS.some(c => c.key === key)) : [];
  const columns = valid(input.columns);
  const order = valid(input.order);
  return {
    columns: columns.length ? columns : [...DEFAULT_OVERVIEW_COLUMNS],
    order: orderOverviewColumns([...order, ...OVERVIEW_COLUMNS.map(c => c.key).filter(key => !order.includes(key))]),
  };
}
