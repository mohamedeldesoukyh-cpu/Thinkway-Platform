import type { ComponentProps, ReactNode } from "react";

import {
  SAFE_GRID_TD,
  SAFE_GRID_TH,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid-styles";
import {
  assignmentChildColDataAttr,
  assignmentParentColDataAttr,
} from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { cn } from "@/lib/utils";

type AssignmentGridRowProps = {
  cols: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"div">, "className" | "children">;

export function AssignmentGridRow({
  cols,
  className,
  children,
  style,
  ...rest
}: AssignmentGridRowProps) {
  return (
    <div
      role="row"
      className={cn("tw-g", className)}
      style={{ ["--cols" as string]: cols, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

type AssignmentGridCellProps = {
  columnId?: string;
  childColumnId?: string;
  header?: boolean;
  children?: ReactNode;
} & Omit<ComponentProps<"div">, "children">;

export function AssignmentGridCell({
  columnId,
  childColumnId,
  header = false,
  className,
  children,
  ...rest
}: AssignmentGridCellProps) {
  return (
    <div
      role={header ? "columnheader" : "gridcell"}
      {...(columnId ? assignmentParentColDataAttr(columnId) : {})}
      {...(childColumnId ? assignmentChildColDataAttr(childColumnId) : {})}
      className={cn(header ? SAFE_GRID_TH : SAFE_GRID_TD, className)}
      {...rest}
    >
      {children ?? <span />}
    </div>
  );
}
