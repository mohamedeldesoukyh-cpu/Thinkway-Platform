/**
 * Presentation helpers for the Overview Report UI.
 *
 * Pure functions only: no financial formulas live here. Every amount shown by
 * the report comes from `OverviewReport` as computed server-side by
 * `buildOverviewReport`; this module only describes, orders and labels it.
 */
import {
  OVERVIEW_COLUMNS,
  orderOverviewColumns,
  type OverviewColumn,
  type OverviewFilters,
  type OverviewReport,
} from "@/lib/reports/overview/overview-report";
import { reorderTableColumns } from "@/lib/tables/operational-table-column-settings";

/** Visual category of a column. Drives tints, header markers and the legend. */
export type OverviewColumnKind = "text" | "actual" | "accrued" | "total" | "share" | "afterShare";

/** Related columns that share a group heading (Revenue / Cost / Gross profit / Revenue share). */
export type OverviewColumnFamily = "campaign" | "revenue" | "cost" | "gp" | "share";

export type OverviewColumnMeta = {
  key: OverviewColumn;
  /** Concise heading from REQUIREMENTS.md, e.g. "Acc. Rev." */
  label: string;
  /** Full name, for tooltips, settings and assistive technology. */
  fullName: string;
  /** One-line meaning, including the formula where one applies. */
  meaning: string;
  numeric: boolean;
  kind: OverviewColumnKind;
  family: OverviewColumnFamily;
};

const DESCRIPTIONS: Record<OverviewColumn, { fullName: string; meaning: string; family: OverviewColumnFamily }> = {
  group: { fullName: "Group name", meaning: "Client holding group", family: "campaign" },
  client: { fullName: "Client name", meaning: "Client", family: "campaign" },
  brand: { fullName: "Brand", meaning: "Campaign brand", family: "campaign" },
  campaign: { fullName: "Campaign name", meaning: "Campaign", family: "campaign" },
  revenue: { fullName: "Revenue", meaning: "Went-live revenue", family: "revenue" },
  accruedRevenue: { fullName: "Accrued revenue", meaning: "Revenue not yet live", family: "revenue" },
  totalRevenue: { fullName: "Total revenue", meaning: "Rev. + Acc. Rev.", family: "revenue" },
  cost: { fullName: "Cost", meaning: "Went-live cost", family: "cost" },
  accruedCost: { fullName: "Accrued cost", meaning: "Cost not yet live", family: "cost" },
  totalCost: { fullName: "Total cost", meaning: "Cost + Acc. Cost", family: "cost" },
  gp: { fullName: "Gross profit", meaning: "Rev. − Cost", family: "gp" },
  accruedGp: { fullName: "Accrued gross profit", meaning: "Acc. Rev. − Acc. Cost", family: "gp" },
  totalGp: { fullName: "Total gross profit", meaning: "Total Rev. − Total Cost, before revenue share", family: "gp" },
  revenueShare: { fullName: "Revenue share", meaning: "Full campaign revenue-share amount in the display currency", family: "share" },
  gpAfterShare: { fullName: "Gross profit after revenue share", meaning: "Total GP − Rev. Share", family: "share" },
};

export const OVERVIEW_FAMILY_LABEL: Record<OverviewColumnFamily, string> = {
  campaign: "Campaign",
  revenue: "Revenue",
  cost: "Cost",
  gp: "Gross profit",
  share: "Revenue share",
};

function kindOf(column: (typeof OVERVIEW_COLUMNS)[number]): OverviewColumnKind {
  if (!column.numeric) return "text";
  if (column.key === "revenueShare") return "share";
  if (column.key === "gpAfterShare") return "afterShare";
  if (column.accrued) return "accrued";
  if (column.total) return "total";
  return "actual";
}

export const OVERVIEW_COLUMN_META: Record<OverviewColumn, OverviewColumnMeta> = Object.fromEntries(
  OVERVIEW_COLUMNS.map(column => [
    column.key,
    { key: column.key, label: column.label, numeric: column.numeric, kind: kindOf(column), ...DESCRIPTIONS[column.key] },
  ])
) as Record<OverviewColumn, OverviewColumnMeta>;

export const OVERVIEW_COLUMN_KEYS: OverviewColumn[] = OVERVIEW_COLUMNS.map(column => column.key);

/** Header group cells for the two-row table header: consecutive same-family columns share one heading. */
export type OverviewHeaderGroup = { family: OverviewColumnFamily; label: string; span: number; firstKey: OverviewColumn };

export function overviewHeaderGroups(visible: readonly OverviewColumn[]): OverviewHeaderGroup[] {
  const groups: OverviewHeaderGroup[] = [];
  for (const key of visible) {
    const family = OVERVIEW_COLUMN_META[key].family;
    const last = groups[groups.length - 1];
    if (last && last.family === family) last.span += 1;
    else groups.push({ family, label: OVERVIEW_FAMILY_LABEL[family], span: 1, firstKey: key });
  }
  return groups;
}

/**
 * Moves a column and re-applies the report's ordering rules, exactly as the
 * previous drag implementation did. Returns the input array when nothing changes,
 * so callers can detect a no-op (e.g. a total that snaps back beside its amounts).
 */
export function moveOverviewColumn(order: OverviewColumn[], from: number, to: number): OverviewColumn[] {
  const next = orderOverviewColumns(reorderTableColumns(order, from, to) as OverviewColumn[]);
  return next.every((key, index) => key === order[index]) ? order : next;
}

/**
 * Keyboard "Move up/down". A one-place move can be a no-op because totals and
 * revenue-share columns snap back beside their related columns, so this keeps
 * stepping in the same direction until the order actually changes. Returns
 * the input array when no move in that direction is possible.
 */
export function stepOverviewColumn(order: OverviewColumn[], key: OverviewColumn, direction: -1 | 1): OverviewColumn[] {
  const from = order.indexOf(key);
  if (from < 0) return order;
  for (let to = from + direction; to >= 0 && to < order.length; to += direction) {
    const next = moveOverviewColumn(order, from, to);
    if (next !== order && next.indexOf(key) !== from) return next;
  }
  return order;
}

/** Amount formatting: grouped, always two decimals, true minus sign for negatives. */
const amountFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function formatOverviewAmount(value: number): string {
  const text = amountFormat.format(Math.abs(value));
  // Avoid "−0.00": rounding to cents may produce a negative zero.
  return value < 0 && text !== "0.00" ? `−${text}` : text;
}

export type AmountTone = "negative" | "zero" | "default";
export function amountTone(value: number): AmountTone {
  if (formatOverviewAmount(value) === "0.00") return "zero";
  return value < 0 ? "negative" : "default";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-13" -> "13 Nov 2026"; empty or invalid input returns "". */
export function formatOverviewDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  // Fixed month names: ICU versions disagree on "Sep" vs "Sept", and server/client output must match.
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

type FilterKey = Exclude<keyof OverviewFilters, "columns">;

/** Filter keys in the order they appear as chips. Currency and as-of are report basis, not removable filters. */
export const OVERVIEW_CHIP_FILTER_KEYS = [
  "q", "groupId", "clientId", "brandId", "campaignId", "status", "clientType", "activity", "from", "to",
] as const satisfies readonly FilterKey[];

/** Filters that live in the collapsible "More filters" area. */
export const OVERVIEW_ADVANCED_FILTER_KEYS = ["status", "clientType", "activity", "from", "to", "asOf", "currency"] as const satisfies readonly FilterKey[];

export const CLIENT_TYPE_OPTIONS = [
  { value: "agency", label: "Agency" },
  { value: "direct", label: "Direct" },
] as const;

export const ACTIVITY_OPTIONS = [
  { value: "actual", label: "Has went-live activity" },
  { value: "accrued", label: "Has accrual amounts" },
  { value: "both", label: "Actual and accrued" },
] as const;

export type OverviewFilterChip = { key: (typeof OVERVIEW_CHIP_FILTER_KEYS)[number]; label: string; value: string };

const CHIP_LABEL: Record<OverviewFilterChip["key"], string> = {
  q: "Search",
  groupId: "Group",
  clientId: "Client",
  brandId: "Brand",
  campaignId: "Campaign",
  status: "Status",
  clientType: "Client type",
  activity: "Activity",
  from: "Start from",
  to: "Start to",
};

/** Chips for the APPLIED filters (what the table currently shows), never the draft. */
export function overviewFilterChips(filters: OverviewFilters, options: OverviewReport["options"]): OverviewFilterChip[] {
  const optionLabel = (key: "groupId" | "clientId" | "brandId" | "campaignId" | "status", value: string) =>
    options[key].find(option => option.value === value)?.label ?? value;
  const chips: OverviewFilterChip[] = [];
  for (const key of OVERVIEW_CHIP_FILTER_KEYS) {
    const value = filters[key];
    if (!value) continue;
    let display: string = value;
    if (key === "q") display = `“${value}”`;
    else if (key === "groupId" || key === "clientId" || key === "brandId" || key === "campaignId" || key === "status") display = optionLabel(key, value);
    else if (key === "clientType") display = CLIENT_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value;
    else if (key === "activity") display = ACTIVITY_OPTIONS.find(o => o.value === value)?.label ?? value;
    else if (key === "from" || key === "to") display = formatOverviewDate(value) || value;
    if (key === "status") display = display.charAt(0).toUpperCase() + display.slice(1);
    chips.push({ key, label: CHIP_LABEL[key], value: display });
  }
  return chips;
}

/** Number of applied filters hidden inside "More filters" (shown as a badge on the toggle). */
export function countAdvancedFilters(filters: OverviewFilters): number {
  return (["status", "clientType", "activity", "from", "to"] as const).filter(key => Boolean(filters[key])).length;
}

/** The same cascade as before: group clears client/brand/campaign; client clears brand/campaign; brand clears campaign. */
export function withFilterChange(filters: OverviewFilters, key: FilterKey, value: string): OverviewFilters {
  return {
    ...filters,
    [key]: value,
    ...(key === "groupId" ? { clientId: "", brandId: "", campaignId: "" }
      : key === "clientId" ? { brandId: "", campaignId: "" }
        : key === "brandId" ? { campaignId: "" } : {}),
  };
}

/** True when the draft differs from what is applied (columns are tracked separately). */
export function hasUnappliedFilterChanges(draft: OverviewFilters, applied: OverviewFilters): boolean {
  return (Object.keys(applied) as (keyof OverviewFilters)[])
    .some(key => key !== "columns" && String(draft[key] ?? "") !== String(applied[key] ?? ""));
}

/** Query string for a filter set — identical shape to the previous apply(): non-empty filters, then columns. */
export function overviewFilterSearchParams(filters: OverviewFilters, visibleColumns: readonly OverviewColumn[]): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (key !== "columns" && value) params.set(key, String(value)); });
  params.set("columns", visibleColumns.join(","));
  return params;
}

/** Filter keys whose draft value differs from the applied report (columns excluded). */
export function changedFilterKeys(draft: OverviewFilters, applied: OverviewFilters): FilterKey[] {
  return (Object.keys(applied) as (keyof OverviewFilters)[])
    .filter((key): key is FilterKey => key !== "columns" && String(draft[key] ?? "") !== String(applied[key] ?? ""));
}

export type OverviewDatePreset = { id: string; label: string; from: string; to: string };

const iso = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
};

/**
 * Campaign-start presets relative to `today` (YYYY-MM-DD, normally cairoToday()).
 * They only fill the From/To draft fields; nothing is applied until Apply filters.
 */
export function overviewDatePresets(today: string): OverviewDatePreset[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
  const [y, m] = today.split("-").map(Number);
  const month = m - 1;
  const quarter = Math.floor(month / 3) * 3;
  return [
    { id: "this-month", label: "This month", from: iso(y, month, 1), to: iso(y, month + 1, 0) },
    { id: "last-month", label: "Last month", from: iso(y, month - 1, 1), to: iso(y, month, 0) },
    { id: "this-quarter", label: "This quarter", from: iso(y, quarter, 1), to: iso(y, quarter + 3, 0) },
    { id: "last-quarter", label: "Last quarter", from: iso(y, quarter - 3, 1), to: iso(y, quarter, 0) },
    { id: "ytd", label: "Year to date", from: iso(y, 0, 1), to: today },
    { id: "last-year", label: "Last year", from: iso(y - 1, 0, 1), to: iso(y - 1, 11, 31) },
  ];
}

/** "1 Jul – 30 Sep 2026", "From 1 Jul 2026", "Until 30 Sep 2026" or "". */
export function formatOverviewDateRange(from: string, to: string): string {
  const f = formatOverviewDate(from), t = formatOverviewDate(to);
  if (f && t) {
    if (from.slice(0, 4) === to.slice(0, 4)) return `${f.replace(/ \d{4}$/, "")} – ${t}`;
    return `${f} – ${t}`;
  }
  if (f) return `From ${f}`;
  if (t) return `Until ${t}`;
  return "";
}
