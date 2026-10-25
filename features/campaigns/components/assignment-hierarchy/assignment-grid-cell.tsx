import { ASSIGNMENT_CHILD_GRID_COLUMN_METAS } from "@/lib/tables/assignment-grid-column-metas";
import { Children, isValidElement, type ComponentProps, type ReactNode } from "react";

import {
  SAFE_GRID_TD,
  SAFE_GRID_TH,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid-styles";
import {
  assignmentChildColDataAttr,
  assignmentParentColDataAttr,
  HIERARCHY_COLUMN_LABELS,
  CHILD_COLUMN_LABELS,
} from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { cn } from "@/lib/utils";

type AssignmentGridRowProps = {
  cols: string;
  columnOrder?: readonly string[];
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"div">, "className" | "children">;

export function AssignmentGridRow({
  cols,
  columnOrder,
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
      {columnOrder ? Children.toArray(children).sort((a, b) => {
        const rank = (node: ReactNode) => isValidElement<{ columnId?: string }>(node) ? columnOrder.indexOf(node.props.columnId ?? "") : -1;
        return rank(a) - rank(b);
      }) : children}
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
      data-label={childColumnId
        ? ASSIGNMENT_CHILD_GRID_COLUMN_METAS.find(column => column.id === childColumnId)?.label ?? CHILD_COLUMN_LABELS[childColumnId as keyof typeof CHILD_COLUMN_LABELS] ?? childColumnId
        : columnId ? HIERARCHY_COLUMN_LABELS[columnId as keyof typeof HIERARCHY_COLUMN_LABELS] : undefined}
      {...(columnId ? assignmentParentColDataAttr(columnId) : {})}
      {...(childColumnId ? assignmentChildColDataAttr(childColumnId) : {})}
      className={cn(header ? SAFE_GRID_TH : SAFE_GRID_TD, className)}
      {...rest}
    >
      {children ?? <span />}
    </div>
  );
}
