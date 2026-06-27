import type { AssignmentsGridGates } from "@/lib/campaigns/assignments-grid-gates";
import { ASSIGNMENT_GRID_COLUMN_METAS } from "@/lib/tables/assignment-grid-column-metas";

import {
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX,
  CHILD_GRID_TRAILING_COLUMNS,
  sumChildGridColumnWidths,
  type AssignmentGridColumnWidthId,
  type ChildGridTrailingColumnId,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";

export type AssignmentGridColumnId = (typeof ASSIGNMENT_GRID_COLUMN_METAS)[number]["id"];

/** Parent safe-grid column order — matches AssignmentSafeGrid header cells. */
export const ASSIGNMENT_GRID_PARENT_COLUMN_ORDER: AssignmentGridColumnId[] =
  ASSIGNMENT_GRID_COLUMN_METAS.map((meta) => meta.id);

export function isAssignmentGridColumnVisible(
  columnId: AssignmentGridColumnId,
  col: (id: string) => boolean,
  gates: AssignmentsGridGates
): boolean {
  switch (columnId) {
    case "expand":
      // Chevron renders inside the assignment cell — never allocate a parent column.
      return false;
    case "cost":
    case "usageRightsCost":
    case "gp":
    case "margin":
    case "payout":
      return gates.showInternalFinancials && col(columnId);
    case "billing":
      return gates.showInternalBilling && col(columnId);
    case "actions":
      return gates.enableEditActions && col(columnId);
    default:
      return col(columnId);
  }
}

export function getVisibleAssignmentGridColumns(
  col: (id: string) => boolean,
  gates: AssignmentsGridGates
): AssignmentGridColumnId[] {
  return ASSIGNMENT_GRID_PARENT_COLUMN_ORDER.filter((id) =>
    isAssignmentGridColumnVisible(id, col, gates)
  );
}

/** Parent + child leading column count through Rev (inclusive). */
export function countLeadingColumnsThroughRev(
  col: (id: string) => boolean,
  gates: AssignmentsGridGates
): number {
  const visible = getVisibleAssignmentGridColumns(col, gates);
  const revIndex = visible.indexOf("revenue");
  return revIndex === -1 ? 0 : revIndex + 1;
}

/** Fallback leading widths (expand…Rev) before parent DOM measurement. */
export function getFallbackLeadingWidths(
  col: (id: string) => boolean,
  gates: AssignmentsGridGates
): number[] {
  const visible = getVisibleAssignmentGridColumns(col, gates);
  const revIndex = visible.indexOf("revenue");
  if (revIndex === -1) return [];

  return visible.slice(0, revIndex + 1).map(
    (id) => ASSIGNMENT_GRID_COLUMN_WIDTH_PX[id as AssignmentGridColumnWidthId]
  );
}

/** Parent column ids mirrored by child leading cols (through Rev). */
export function getChildLeadingParentColumnIds(
  col: (id: string) => boolean,
  gates: AssignmentsGridGates
): AssignmentGridColumnId[] {
  const visible = getVisibleAssignmentGridColumns(col, gates);
  const revIndex = visible.indexOf("revenue");
  if (revIndex === -1) return [];
  return visible.slice(0, revIndex + 1);
}

export function sumVisibleParentColumnWidths(
  col: (id: string) => boolean,
  gates: AssignmentsGridGates
): number {
  return sumChildGridColumnWidths(
    getVisibleAssignmentGridColumns(col, gates).map(
      (id) => ASSIGNMENT_GRID_COLUMN_WIDTH_PX[id as AssignmentGridColumnWidthId]
    )
  );
}

export function isChildGridTrailingColumnVisible(
  columnId: ChildGridTrailingColumnId,
  childCol: (id: string) => boolean
): boolean {
  return childCol(columnId);
}

export function getVisibleChildTrailingColumns(
  childCol: (id: string) => boolean
): (typeof CHILD_GRID_TRAILING_COLUMNS)[number][] {
  return CHILD_GRID_TRAILING_COLUMNS.filter((column) =>
    isChildGridTrailingColumnVisible(column.id, childCol)
  );
}

export function getVisibleChildTrailingWidths(
  childCol: (id: string) => boolean,
  measuredTrailingWidths?: readonly number[] | null
): number[] {
  const visibleColumns = getVisibleChildTrailingColumns(childCol);
  if (
    measuredTrailingWidths &&
    measuredTrailingWidths.length === CHILD_GRID_TRAILING_COLUMNS.length
  ) {
    return visibleColumns.map((column) => {
      const index = CHILD_GRID_TRAILING_COLUMNS.findIndex((item) => item.id === column.id);
      return measuredTrailingWidths[index] ?? column.width;
    });
  }
  return visibleColumns.map((column) => column.width);
}

export function fallbackChildTableWidthPx(
  col: (id: string) => boolean,
  gates: AssignmentsGridGates,
  childCol: (id: string) => boolean = () => true
): number {
  return (
    sumChildGridColumnWidths(getFallbackLeadingWidths(col, gates)) +
    sumChildGridColumnWidths(getVisibleChildTrailingWidths(childCol))
  );
}
