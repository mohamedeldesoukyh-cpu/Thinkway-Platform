import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_COST_AMOUNT_CLASS,
  OPERATIONAL_REVENUE_AMOUNT_CLASS,
  OPERATIONAL_TABLE_HEADER_CELL,
  OPERATIONAL_TABLE_HEADER_SURFACE,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

/** Parent column count — keep in sync with AssignmentSafeGrid header cells. */
export const ASSIGNMENT_SAFE_GRID_COL_SPAN = 18;

export const SAFE_GRID_SHELL = cn(
  OPERATIONAL_TABLE_SURFACE,
  "overflow-hidden rounded-xl border border-border/60 shadow-sm"
);

export const SAFE_GRID_TABLE = "w-full min-w-[1120px] table-fixed border-collapse text-sm";

export const SAFE_GRID_HEAD = cn(
  OPERATIONAL_TABLE_HEADER_SURFACE,
  "sticky top-0 z-10 border-b border-border/60"
);

export const SAFE_GRID_TH = cn(
  OPERATIONAL_TABLE_HEADER_CELL,
  "border-b border-border/50 px-1.5 py-2.5 align-middle text-center"
);

export const SAFE_GRID_TD = cn(
  "border-b border-border/40 px-1.5 py-1.5 align-middle text-center text-[11px]"
);

export const SAFE_GRID_CONTROL_CELL = cn(SAFE_GRID_TD, "w-9 px-1.5 text-center");

export const SAFE_GRID_PARENT_ROW = cn(
  "border-b border-border/45 transition-colors",
  "hover:bg-muted/35"
);

export const SAFE_GRID_PARENT_ROW_EXPANDED = cn(
  "sticky top-[41px] z-[5] border-b-0 shadow-sm",
  OPERATIONAL_TABLE_SURFACE
);

export const SAFE_GRID_CHILD_GROUP_ROW = "border-b border-border/50 bg-muted/20";

/** Child expansion cell — left border aligns with parent row accent (no extra inset). */
export const SAFE_GRID_CHILD_GROUP_CELL = cn("bg-muted/20 p-0");

/** Full-width rule between child block and the next parent row. */
export const SAFE_GRID_CHILD_GROUP_BOTTOM_RULE = "border-b-2 border-black";

export const SAFE_GRID_AMOUNT = OPERATIONAL_AMOUNT_CLASS;

/** Parent financial emphasis — Rev/Cost strongest, GP secondary. */
export const SAFE_GRID_HIGHLIGHT_REV = cn(
  SAFE_GRID_TD,
  OPERATIONAL_REVENUE_AMOUNT_CLASS,
  "bg-primary/8 font-semibold"
);

export const SAFE_GRID_HIGHLIGHT_COST = cn(
  SAFE_GRID_TD,
  OPERATIONAL_COST_AMOUNT_CLASS,
  "bg-amber-500/10 font-semibold dark:bg-amber-500/15"
);

export const SAFE_GRID_HIGHLIGHT_TOTAL_BILLING = cn(
  SAFE_GRID_TD,
  OPERATIONAL_REVENUE_AMOUNT_CLASS,
  "bg-sky-500/10 font-semibold dark:bg-sky-500/12"
);

export const SAFE_GRID_HIGHLIGHT_GP = cn(
  SAFE_GRID_TD,
  SAFE_GRID_AMOUNT,
  "font-semibold"
);

export const SAFE_GRID_CHECKBOX =
  "size-3.5 shrink-0 rounded border-border accent-primary";
