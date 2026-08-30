"use client";

import { Fragment, type ReactElement, type ReactNode } from "react";

import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { useOperationalTableColumnsContext } from "@/components/tables/operational-table-column-context";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import type {
  OperationalAmountVariant,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { operationalAmountVariantClass } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { cn } from "@/lib/utils";

export type OperationalConfigurableColumnDef<T> = OperationalTableColumnMeta & {
  headerClassName?: string;
  cellClassName?: string;
  /** Optional native `title` on the cell (e.g. full label when truncated). */
  cellTitle?: (row: T) => string | undefined;
  /** Optional `<col>` width (e.g. `"25%"`, `"120px"`). Defaults to equal share of remaining width. */
  colWidth?: string;
  amountCell?: boolean;
  /** Semantic platform coloring for money cells (revenue, gp, cost, margin). */
  amountVariant?: OperationalAmountVariant;
  /** Numeric value for dynamic gp/margin coloring. */
  amountValue?: (row: T) => number;
  monoCell?: boolean;
  renderHeader?: () => ReactNode;
  renderCell: (row: T) => ReactNode;
};

export function getOperationalTableColumnMetas<T>(
  columns: readonly OperationalConfigurableColumnDef<T>[]
): OperationalTableColumnMeta[] {
  return columns.map(({ id, label, defaultVisible, locked }) => ({
    id,
    label,
    defaultVisible,
    locked,
  }));
}

type OperationalConfigurableTableProps<T> = {
  columns: readonly OperationalConfigurableColumnDef<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  className?: string;
  headerCellClassName?: string;
  rowClassName?: (row: T) => string | undefined;
  wrapRow?: (row: T, rowElement: ReactElement) => ReactNode;
};

export function OperationalConfigurableTable<T>({
  columns,
  rows,
  rowKey,
  className,
  headerCellClassName,
  rowClassName,
  wrapRow,
}: OperationalConfigurableTableProps<T>) {
  const { visibleOrderedColumnIds, hydrated } = useOperationalTableColumnsContext();
  const dataContext = useOperationalTableDataContextOptional<T>();
  const displayRows = dataContext?.processedRows ?? rows;

  const columnById = new Map(columns.map((column) => [column.id, column]));
  const visibleColumns = visibleOrderedColumnIds
    .map((id) => columnById.get(id))
    .filter((column): column is OperationalConfigurableColumnDef<T> => Boolean(column));

  if (!hydrated) {
    const defaultColumns = columns.filter((column) => column.defaultVisible !== false);
    return (
      <OperationalConfigurableTableView
        className={className}
        headerCellClassName={headerCellClassName}
        columns={defaultColumns}
        rows={displayRows}
        rowKey={rowKey}
        rowClassName={rowClassName}
        wrapRow={wrapRow}
      />
    );
  }

  return (
    <OperationalConfigurableTableView
      className={className}
      headerCellClassName={headerCellClassName}
      columns={visibleColumns}
      rows={displayRows}
      rowKey={rowKey}
      rowClassName={rowClassName}
      wrapRow={wrapRow}
    />
  );
}

function resolveOperationalTableColumnWidths<T>(
  columns: readonly OperationalConfigurableColumnDef<T>[]
): string[] {
  if (columns.length === 0) {
    return [];
  }

  const equalWidth = `${100 / columns.length}%`;
  return columns.map((column) => column.colWidth ?? equalWidth);
}

function OperationalConfigurableTableView<T>({
  columns,
  rows,
  rowKey,
  className,
  headerCellClassName,
  rowClassName,
  wrapRow,
}: {
  columns: readonly OperationalConfigurableColumnDef<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  className?: string;
  headerCellClassName?: string;
  rowClassName?: (row: T) => string | undefined;
  wrapRow?: (row: T, rowElement: ReactElement) => ReactNode;
}) {
  const columnWidths = resolveOperationalTableColumnWidths(columns);

  return (
    <CampaignOperationalTable className={cn("table-fixed w-full", className)}>
      <colgroup>
        {columns.map((column, index) => (
          <col key={column.id} style={{ width: columnWidths[index] }} />
        ))}
      </colgroup>
      <CampaignOperationalTableHeader>
        <CampaignOperationalTableHeaderRow>
          {columns.map((column) => (
            <CampaignOperationalTableHead
              key={column.id}
              className={cn(
                column.amountCell ? "text-right" : "text-left",
                headerCellClassName,
                column.headerClassName
              )}
            >
              {column.renderHeader ? column.renderHeader() : column.label}
            </CampaignOperationalTableHead>
          ))}
        </CampaignOperationalTableHeaderRow>
      </CampaignOperationalTableHeader>
      <CampaignOperationalTableBody>
        {rows.map((row) => {
          const rowElement = (
            <CampaignOperationalTableRow className={rowClassName?.(row)}>
              {columns.map((column) => {
                const content = column.renderCell(row);
                const sharedCellClassName = column.cellClassName;
                const cellTitle = column.cellTitle?.(row);
                if (column.amountCell) {
                  const amountClassName = column.amountVariant
                    ? operationalAmountVariantClass(
                        column.amountVariant,
                        column.amountValue?.(row)
                      )
                    : undefined;
                  return (
                    <CampaignOperationalTableCellAmount
                      key={column.id}
                      className={cn(amountClassName, sharedCellClassName)}
                      title={cellTitle}
                    >
                      {content}
                    </CampaignOperationalTableCellAmount>
                  );
                }
                if (column.monoCell) {
                  return (
                    <CampaignOperationalTableCellMono
                      key={column.id}
                      className={sharedCellClassName}
                      title={cellTitle}
                    >
                      {content}
                    </CampaignOperationalTableCellMono>
                  );
                }
                return (
                  <CampaignOperationalTableCell
                    key={column.id}
                    className={sharedCellClassName}
                    title={cellTitle}
                  >
                    {content}
                  </CampaignOperationalTableCell>
                );
              })}
            </CampaignOperationalTableRow>
          );

          return (
            <Fragment key={rowKey(row)}>
              {wrapRow ? wrapRow(row, rowElement) : rowElement}
            </Fragment>
          );
        })}
      </CampaignOperationalTableBody>
    </CampaignOperationalTable>
  );
}
