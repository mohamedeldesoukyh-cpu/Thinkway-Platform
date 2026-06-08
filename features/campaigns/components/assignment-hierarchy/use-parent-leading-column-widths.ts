"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

import { CHILD_GRID_LEADING_COLUMN_COUNT } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";

const PARENT_GRID_SELECTOR = "[data-assignment-parent-grid]";

function widthsEqual(a: number[] | null, b: number[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function measureLeadingWidths(
  parentTable: HTMLTableElement,
  lineId: string
): number[] | null {
  const row = parentTable.querySelector(
    `tbody tr[data-line-id="${CSS.escape(lineId)}"]`
  );
  if (row) {
    const cells = row.querySelectorAll(":scope > td");
    if (cells.length >= CHILD_GRID_LEADING_COLUMN_COUNT) {
      return Array.from(cells)
        .slice(0, CHILD_GRID_LEADING_COLUMN_COUNT)
        .map((cell) => Math.round(cell.getBoundingClientRect().width));
    }
  }

  const headers = parentTable.querySelectorAll("thead > tr > th");
  if (headers.length < CHILD_GRID_LEADING_COLUMN_COUNT) return null;

  return Array.from(headers)
    .slice(0, CHILD_GRID_LEADING_COLUMN_COUNT)
    .map((header) => Math.round(header.getBoundingClientRect().width));
}

function resolveParentTable(childTable: HTMLTableElement): HTMLTableElement | null {
  const parent = childTable.parentElement?.closest<HTMLTableElement>(PARENT_GRID_SELECTOR);
  if (!parent || parent === childTable) return null;
  return parent;
}

/** Mirror parent safe-grid widths for child cols 1–9 (through Rev). */
export function useParentLeadingColumnWidths(
  tableRef: RefObject<HTMLTableElement | null>,
  lineId: string
): number[] | null {
  const [leadingWidths, setLeadingWidths] = useState<number[] | null>(null);

  useLayoutEffect(() => {
    const childTable = tableRef.current;
    if (!childTable) return;

    const parentTable = resolveParentTable(childTable);
    if (!parentTable) return;

    const measure = () => {
      const next = measureLeadingWidths(parentTable, lineId);
      if (!next) return;
      setLeadingWidths((prev) => (widthsEqual(prev, next) ? prev : next));
    };

    measure();
    const raf = requestAnimationFrame(measure);

    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [tableRef, lineId]);

  return leadingWidths;
}
