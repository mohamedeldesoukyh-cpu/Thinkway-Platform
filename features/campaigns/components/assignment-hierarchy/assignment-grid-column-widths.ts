/** Shared financial column widths — parent + child grids stay aligned. */
export const ASSIGNMENT_GRID_MONEY_COL =
  "w-[140px] min-w-[140px] max-w-[140px] text-center tabular-nums";

export const ASSIGNMENT_GRID_VAT_COL =
  "w-[100px] min-w-[100px] max-w-[100px] text-center tabular-nums";

/** Fixed pixel widths for parent safe-grid colgroup (matches Tailwind min/max above). */
export const ASSIGNMENT_GRID_COLUMN_WIDTH_PX = {
  /** Chevron lives in assignment cell — reserve no column width. */
  expand: 0,
  select: 24,
  assignment: 180,
  creator: 180,
  platforms: 72,
  deliverables: 56,
  fullDescription: 220,
  postingDates: 84,
  costCurrency: 56,
  revenue: 140,
  usageRights: 140,
  agencyFeePercent: 100,
  agencyFee: 140,
  cost: 140,
  costVatPercent: 100, costVat: 140, costTotal: 150,
  usageRightsCost: 140,
  revenueVatPercent: 100,
  vat: 140,
  totalBilling: 140,
  gp: 140,
  margin: 100,
  opsStatus: 120,
  billing: 120,
  payout: 120,
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
  { id: "usageRights", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.usageRights },
  { id: "agencyFeePercent", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.agencyFeePercent },
  { id: "agencyFee", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.agencyFee },
  { id: "revenueVatPercent", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.revenueVatPercent },
  { id: "vat", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.vat },
  { id: "totalBilling", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.totalBilling },
  { id: "cost", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.cost },
  { id: "usageRightsCost", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.usageRightsCost },
  { id: "costVatPercent", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.costVatPercent },
  { id: "costVat", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.costVat },
  { id: "costTotal", width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX.costTotal },
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
  "revenueVatPercent",
  "vat",
  "totalBilling",
  "cost",
  "usageRightsCost",
  "costVatPercent",
  "costVat",
  "costTotal",
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
