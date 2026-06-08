/** Shared financial column widths — parent + child grids stay aligned. */
export const ASSIGNMENT_GRID_MONEY_COL =
  "w-[76px] min-w-[76px] max-w-[76px] text-center tabular-nums";

export const ASSIGNMENT_GRID_VAT_COL =
  "w-[56px] min-w-[56px] max-w-[56px] text-center tabular-nums";

/** Child leading cols — widths come from parent header measurement (cols 1–9). */
export const CHILD_GRID_LEADING_COLUMN_COUNT = 9;

/** Width from colgroup; padding matches parent SAFE_GRID_TD. */
export const CHILD_GRID_LEADING_CELL =
  "min-w-0 shrink-0 align-middle text-center px-1.5 py-1.5";

export const CHILD_GRID_MONTH_COL =
  "w-[84px] min-w-[84px] max-w-[84px] text-center";

export const CHILD_GRID_LIVE_DATE_COL = "w-[100px] min-w-[100px] max-w-[100px]";

/** Child cols 10+ (after Rev) — fixed widths. */
export const CHILD_GRID_TRAILING_COL_WIDTHS = [
  76, 56, 100, 84, 64, 72, 40, 52, 56, 56,
] as const;

/** Fallback leading widths before parent measurement (expand + select + assign… + rev). */
export const CHILD_GRID_FALLBACK_LEADING_WIDTHS = [
  36, 36, 140, 120, 90, 56, 84, 56, 76,
] as const;

export function sumChildGridColumnWidths(widths: readonly number[]): number {
  return widths.reduce((total, width) => total + width, 0);
}

export const CHILD_GRID_FALLBACK_TABLE_WIDTH_PX = sumChildGridColumnWidths([
  ...CHILD_GRID_FALLBACK_LEADING_WIDTHS,
  ...CHILD_GRID_TRAILING_COL_WIDTHS,
]);

