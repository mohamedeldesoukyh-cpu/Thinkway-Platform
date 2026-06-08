import {
  CHILD_GRID_FALLBACK_LEADING_WIDTHS,
  CHILD_GRID_TRAILING_COL_WIDTHS,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";

type AssignmentChildTableColGroupProps = {
  leadingWidths: number[] | null;
};

/** Child cols 1–9 mirror parent safe-grid; trailing cols stay fixed. */
export function AssignmentChildTableColGroup({
  leadingWidths,
}: AssignmentChildTableColGroupProps) {
  const leading =
    leadingWidths?.length === CHILD_GRID_FALLBACK_LEADING_WIDTHS.length
      ? leadingWidths
      : [...CHILD_GRID_FALLBACK_LEADING_WIDTHS];

  return (
    <colgroup>
      {leading.map((width, index) => (
        <col key={`leading-${index}`} style={{ width }} />
      ))}
      {CHILD_GRID_TRAILING_COL_WIDTHS.map((width, index) => (
        <col key={`trailing-${index}`} style={{ width }} />
      ))}
    </colgroup>
  );
}
