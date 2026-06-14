import type { AssignmentsGridGates } from "@/lib/campaigns/assignments-grid-gates";

import {
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX,
  type AssignmentGridColumnWidthId,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";
import { getVisibleAssignmentGridColumns } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-layout";

type AssignmentParentTableColGroupProps = {
  col: (id: string) => boolean;
  gates: AssignmentsGridGates;
};

/** Fixed widths for parent safe-grid — child grid mirrors leading cols through Rev. */
export function AssignmentParentTableColGroup({
  col,
  gates,
}: AssignmentParentTableColGroupProps) {
  const visibleColumns = getVisibleAssignmentGridColumns(col, gates);

  return (
    <colgroup>
      {visibleColumns.map((columnId) => (
        <col
          key={columnId}
          style={{ width: ASSIGNMENT_GRID_COLUMN_WIDTH_PX[columnId as AssignmentGridColumnWidthId] }}
        />
      ))}
    </colgroup>
  );
}
