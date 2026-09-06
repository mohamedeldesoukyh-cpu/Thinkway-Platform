import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_COST_AMOUNT_CLASS,
  OPERATIONAL_REVENUE_AMOUNT_CLASS,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

/** Parent column count — keep in sync with AssignmentSafeGrid header cells. */
export const ASSIGNMENT_SAFE_GRID_COL_SPAN = 19;

export const SAFE_GRID_SHELL = cn(
  "thinkway-campaign-asgn-table-root min-w-0 border-0 bg-transparent shadow-none"
);

export const SAFE_GRID_TABLE =
  "thinkway-campaign-asgn-table min-w-[1300px] w-max";

export const SAFE_GRID_HEAD = cn(
  "thinkway-campaign-asgn-col-hdrs sticky top-0 z-10 border-b border-[var(--camp-border)] bg-[var(--camp-surface)]"
);

export const SAFE_GRID_TH = cn(
  "thinkway-campaign-asgn-th align-middle text-left"
);

export const SAFE_GRID_TD = cn("thinkway-campaign-asgn-td align-middle");

export const SAFE_GRID_CONTROL_CELL = cn(SAFE_GRID_TD, "w-6 px-0 text-center");

export const SAFE_GRID_PARENT_ROW = cn(
  "thinkway-campaign-asgn-parent border-b border-[var(--camp-border)] transition-colors"
);

export const SAFE_GRID_PARENT_ROW_EXPANDED = cn(
  "thinkway-campaign-asgn-parent-open border-b-0"
);

/** Visually hidden expand column — chevron lives in the assignment cell. */
export const SAFE_GRID_EXPAND_CELL = cn(
  SAFE_GRID_CONTROL_CELL,
  "w-0 max-w-0 overflow-hidden border-0 p-0"
);

export const SAFE_GRID_CHILD_GROUP_ROW = "thinkway-campaign-asgn-child-hdr";

/** Child expansion cell — left border aligns with parent row accent (no extra inset). */
export const SAFE_GRID_CHILD_GROUP_CELL = cn("thinkway-campaign-asgn-child-group-cell bg-[#e7edf7] p-0");

/** Full-width rule between child block and the next parent row. */
export const SAFE_GRID_CHILD_GROUP_BOTTOM_RULE = "border-b border-[var(--camp-border)]";

export const SAFE_GRID_AMOUNT = OPERATIONAL_AMOUNT_CLASS;

/** Parent financial emphasis — Rev/Cost strongest, GP secondary. */
export const SAFE_GRID_HIGHLIGHT_REV = cn(
  SAFE_GRID_TD,
  OPERATIONAL_REVENUE_AMOUNT_CLASS,
  "thinkway-campaign-cell-rev font-semibold"
);

export const SAFE_GRID_HIGHLIGHT_COST = cn(
  SAFE_GRID_TD,
  OPERATIONAL_COST_AMOUNT_CLASS,
  "thinkway-campaign-cell-cost font-semibold"
);

export const SAFE_GRID_HIGHLIGHT_TOTAL_BILLING = cn(
  SAFE_GRID_TD,
  OPERATIONAL_REVENUE_AMOUNT_CLASS,
  "thinkway-campaign-cell-billing-total font-semibold"
);

export const SAFE_GRID_HIGHLIGHT_GP = cn(
  SAFE_GRID_TD,
  SAFE_GRID_AMOUNT,
  "thinkway-campaign-cell-gp font-semibold"
);

export const SAFE_GRID_CHECKBOX =
  "size-3.5 shrink-0 rounded border-[var(--camp-border)] accent-[var(--camp-blue)]";
