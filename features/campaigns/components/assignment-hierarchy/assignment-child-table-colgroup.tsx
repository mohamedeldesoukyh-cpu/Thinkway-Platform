"use client";

import { useMemo } from "react";

import { getVisibleChildTrailingWidths } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-layout";
import { useOperationalChildColumnVisibleChecker } from "@/components/tables/operational-table-column-context";

type AssignmentChildTableColGroupProps = {
  leadingWidths: number[] | null;
  trailingWidths?: number[] | null;
  fallbackLeadingWidths: readonly number[];
};

/** Child leading cols mirror parent through Rev; trailing cols respect child visibility. */
export function AssignmentChildTableColGroup({
  leadingWidths,
  trailingWidths,
  fallbackLeadingWidths,
}: AssignmentChildTableColGroupProps) {
  const childCol = useOperationalChildColumnVisibleChecker();

  const leading =
    leadingWidths?.length === fallbackLeadingWidths.length
      ? leadingWidths
      : [...fallbackLeadingWidths];

  const trailing = useMemo(
    () => getVisibleChildTrailingWidths(childCol, trailingWidths),
    [childCol, trailingWidths]
  );

  return (
    <colgroup>
      {leading.map((width, index) => (
        <col key={`leading-${index}`} style={{ width }} />
      ))}
      {trailing.map((width, index) => (
        <col key={`trailing-${index}`} style={{ width }} />
      ))}
    </colgroup>
  );
}
