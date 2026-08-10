/** Shared financial column widths — parent + child grids stay aligned. */
export const ASSIGNMENT_GRID_MONEY_COL =
  "w-[76px] min-w-[76px] max-w-[76px] text-center tabular-nums";

export const ASSIGNMENT_GRID_VAT_COL =
  "w-[56px] min-w-[56px] max-w-[56px] text-center tabular-nums";

/** Fixed pixel widths for parent safe-grid colgroup (matches Tailwind min/max above). */
export const ASSIGNMENT_GRID_COLUMN_WIDTH_PX = {
  /** Chevron lives in assignment cell — reserve no column width. */
  expand: 0,
  select: 24,
  assignment: 160,
  creator: 108,
  platforms: 72,
  deliverables: 56,
  fullDescription: 180,
  postingDates: 84,
  costCurrency: 56,
  revenue: 76,
  usageRights: 76,
  agencyFeePercent: 56,
  agencyFee: 76,
  cost: 76,
  usageRightsCost: 76,
  vat: 56,
  totalBilling: 96,
  gp: 76,
  margin: 56,
  opsStatus: 72,
  billing: 72,
  payout: 88,
  actions: 40,
} as const;

export type AssignmentGridColumnWidthId = keyof typeof ASSIGNMENT_GRID_COLUMN_WIDTH_PX;

/** Child leading cols — widths come from parent measurement (select … Rev). */
export const CHILD_GRID_LEADING_COLUMN_COUNT = 9;

/** Width from colgroup; padding matches parent SAFE_GRID_TD. */
export const CHILD_GRID_LEADING_CELL =
  "min-w-0 shrink-0 align-middle text-center px-1.5 py-1.5";

export const CHILD_GRID_MONTH_COL =
  "w-[84px] min-w-[84px] max-w-[84px] text-center";

export const CHILD_GRID_LIVE_DATE_COL =
  "w-[200px] min-w-[200px] max-w-[200px] text-center";

/** Child cols 10+ (after Rev) — UR Rev, AF %, AF, Cost, then child-only cols. */
export const CHILD_GRID_TRAILING_COLUMNS = [
  { id: "usageRights", width: 76 },
  { id: "agencyFeePercent", width: 56 },
  { id: "agencyFee", width: 76 },
  { id: "cost", width: 76 },
  { id: "usageRightsCost", width: 76 },
  { id: "vat", width: 56 },
  { id: "totalBilling", width: 76 },
  { id: "postDate", width: 200 },
  { id: "liveAdMonth", width: 84 },
  { id: "invoice", width: 64 },
  { id: "billing", width: 72 },
  { id: "collection", width: 40 },
  { id: "payout", width: 52 },
  { id: "workflow", width: 56 },
  { id: "actions", width: 56 },
] as const;

export type ChildGridTrailingColumnId =
  (typeof CHILD_GRID_TRAILING_COLUMNS)[number]["id"];

export const CHILD_GRID_TRAILING_FINANCIAL_COLUMN_IDS = [
  "usageRights",
  "agencyFeePercent",
  "agencyFee",
  "cost",
  "usageRightsCost",
  "vat",
  "totalBilling",
] as const satisfies readonly ChildGridTrailingColumnId[];

export const CHILD_GRID_TRAILING_COL_WIDTHS = CHILD_GRID_TRAILING_COLUMNS.map(
  (column) => column.width
);

/** Fallback leading widths when select + assign… + Rev are all visible. */
export const CHILD_GRID_FALLBACK_LEADING_WIDTHS = [
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX.select,
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX.assignment,
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX.creator,
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX.platforms,
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX.deliverables,
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX.postingDates,
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX.costCurrency,
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX.revenue,
] as const;

export function assignmentGridColumnWidthPx(
  columnId: AssignmentGridColumnWidthId
): number {
  return ASSIGNMENT_GRID_COLUMN_WIDTH_PX[columnId];
}

export function resolveAssignmentGridColumnWidthPx(columnId: string): number {
  if (columnId in ASSIGNMENT_GRID_COLUMN_WIDTH_PX) {
    return ASSIGNMENT_GRID_COLUMN_WIDTH_PX[
      columnId as AssignmentGridColumnWidthId
    ];
  }
  return 72;
}

export function sumChildGridColumnWidths(widths: readonly number[]): number {
  return widths.reduce((total, width) => total + width, 0);
}

export const CHILD_GRID_FALLBACK_TABLE_WIDTH_PX = sumChildGridColumnWidths([
  ...CHILD_GRID_FALLBACK_LEADING_WIDTHS,
  ...CHILD_GRID_TRAILING_COL_WIDTHS,
]);
