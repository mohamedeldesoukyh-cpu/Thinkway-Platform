"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

import {
  CHILD_GRID_TRAILING_COL_WIDTHS,
  CHILD_GRID_TRAILING_FINANCIAL_COLUMN_IDS,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";

const PARENT_GRID_SELECTOR = "[data-assignment-parent-grid]";
const PARENT_COL_ATTR = "data-assignment-col";

export type ChildGridMeasuredWidths = {
  leading: number[];
  trailing: number[];
};

function widthsEqual(
  a: ChildGridMeasuredWidths | null,
  b: ChildGridMeasuredWidths
): boolean {
  if (!a) return false;
  if (a.leading.length !== b.leading.length || a.trailing.length !== b.trailing.length) {
    return false;
  }
  return (
    a.leading.every((value, index) => value === b.leading[index]) &&
    a.trailing.every((value, index) => value === b.trailing[index])
  );
}

function measureCellWidth(container: Element, columnId: string): number | null {
  const cell = container.querySelector<HTMLElement>(
    `[${PARENT_COL_ATTR}="${CSS.escape(columnId)}"]`
  );
  if (!cell) return null;
  return Math.round(cell.getBoundingClientRect().width);
}

function measureLeadingWidths(
  parentTable: HTMLTableElement,
  lineId: string,
  leadingColumnIds: readonly string[]
): number[] | null {
  if (leadingColumnIds.length === 0) return null;

  const row = parentTable.querySelector(
    `tbody tr[data-line-id="${CSS.escape(lineId)}"]`
  );
  const source = row ?? parentTable.querySelector("thead > tr");
  if (!source) return null;

  const widths: number[] = [];
  for (const columnId of leadingColumnIds) {
    const width = measureCellWidth(source, columnId);
    if (width == null) return null;
    widths.push(width);
  }

  return widths;
}

function measureTrailingFinancialWidths(
  parentTable: HTMLTableElement,
  lineId: string
): number[] | null {
  const row = parentTable.querySelector(
    `tbody tr[data-line-id="${CSS.escape(lineId)}"]`
  );
  const source = row ?? parentTable.querySelector("thead > tr");
  if (!source) return null;

  const widths: number[] = [];
  for (const columnId of CHILD_GRID_TRAILING_FINANCIAL_COLUMN_IDS) {
    const width = measureCellWidth(source, columnId);
    if (width == null) return null;
    widths.push(width);
  }

  return widths;
}

function resolveParentTable(childTable: HTMLTableElement): HTMLTableElement | null {
  const parent = childTable.parentElement?.closest<HTMLTableElement>(PARENT_GRID_SELECTOR);
  if (!parent || parent === childTable) return null;
  return parent;
}

function buildTrailingWidths(financialWidths: number[] | null): number[] {
  const nonFinancial = CHILD_GRID_TRAILING_COL_WIDTHS.slice(
    CHILD_GRID_TRAILING_FINANCIAL_COLUMN_IDS.length
  );
  if (
    financialWidths &&
    financialWidths.length === CHILD_GRID_TRAILING_FINANCIAL_COLUMN_IDS.length
  ) {
    return [...financialWidths, ...nonFinancial];
  }
  return [...CHILD_GRID_TRAILING_COL_WIDTHS];
}

/** Mirror parent safe-grid widths for child leading cols through Rev + financial trailing. */
export function useParentLeadingColumnWidths(
  tableRef: RefObject<HTMLTableElement | null>,
  lineId: string,
  leadingColumnIds: readonly string[]
): ChildGridMeasuredWidths | null {
  const [widths, setWidths] = useState<ChildGridMeasuredWidths | null>(null);
  const leadingKey = leadingColumnIds.join("|");

  useLayoutEffect(() => {
    const childTable = tableRef.current;
    if (!childTable || leadingColumnIds.length === 0) return;

    const parentTable = resolveParentTable(childTable);
    if (!parentTable) return;

    const measure = () => {
      const leading = measureLeadingWidths(parentTable, lineId, leadingColumnIds);
      if (!leading) return;
      const trailingFinancial = measureTrailingFinancialWidths(parentTable, lineId);
      const next: ChildGridMeasuredWidths = {
        leading,
        trailing: buildTrailingWidths(trailingFinancial),
      };
      setWidths((prev) => (widthsEqual(prev, next) ? prev : next));
    };

    measure();
    const raf = requestAnimationFrame(measure);

    window.addEventListener("resize", measure);

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(parentTable);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [tableRef, lineId, leadingKey, leadingColumnIds]);

  return widths;
}
