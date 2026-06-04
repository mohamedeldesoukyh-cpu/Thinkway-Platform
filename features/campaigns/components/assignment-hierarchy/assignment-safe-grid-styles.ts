import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_TABLE_HEADER_CELL,
  OPERATIONAL_TABLE_HEADER_SURFACE,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

/** Parent column count — keep in sync with AssignmentSafeGrid header cells. */
export const ASSIGNMENT_SAFE_GRID_COL_SPAN = 17;

export const SAFE_GRID_SHELL = cn(
  OPERATIONAL_TABLE_SURFACE,
  "overflow-hidden rounded-xl border border-border/60 shadow-sm"
);

export const SAFE_GRID_TABLE = "w-full min-w-[1120px] border-collapse text-sm";

export const SAFE_GRID_HEAD = cn(
  OPERATIONAL_TABLE_HEADER_SURFACE,
  "sticky top-0 z-10 border-b border-border/60"
);

export const SAFE_GRID_TH = cn(
  OPERATIONAL_TABLE_HEADER_CELL,
  "border-b border-border/50 px-2 py-2.5"
);

export const SAFE_GRID_TD = cn(
  "border-b border-border/40 px-2 py-2 align-middle text-[11px]"
);

export const SAFE_GRID_CONTROL_CELL = cn(SAFE_GRID_TD, "w-9 px-2 text-center");

export const SAFE_GRID_PARENT_ROW = cn(
  "border-b border-border/45 transition-colors",
  "hover:bg-muted/35"
);

export const SAFE_GRID_PARENT_ROW_EXPANDED = cn(
  "sticky top-[41px] z-[5] border-b-0 shadow-sm",
  OPERATIONAL_TABLE_SURFACE
);

export const SAFE_GRID_CHILD_GROUP_ROW = "border-b border-border/50 bg-muted/20";

export const SAFE_GRID_CHILD_GROUP_CELL = cn(
  "border-b border-border/50 bg-muted/20 p-0",
  "border-l-[3px] border-l-border/70 pl-3"
);

export const SAFE_GRID_AMOUNT = OPERATIONAL_AMOUNT_CLASS;

export const SAFE_GRID_CHECKBOX =
  "size-3.5 shrink-0 rounded border-border accent-primary";
