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
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { cn } from "@/lib/utils";

export type OperationalConfigurableColumnDef<T> = OperationalTableColumnMeta & {
  headerClassName?: string;
  cellClassName?: string;
  amountCell?: boolean;
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
  rowClassName?: (row: T) => string | undefined;
  wrapRow?: (row: T, rowElement: ReactElement) => ReactNode;
};

export function OperationalConfigurableTable<T>({
  columns,
  rows,
  rowKey,
  className,
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
      columns={visibleColumns}
      rows={displayRows}
      rowKey={rowKey}
      rowClassName={rowClassName}
      wrapRow={wrapRow}
    />
  );
}

function OperationalConfigurableTableView<T>({
  columns,
  rows,
  rowKey,
  className,
  rowClassName,
  wrapRow,
}: {
  columns: readonly OperationalConfigurableColumnDef<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  wrapRow?: (row: T, rowElement: ReactElement) => ReactNode;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <CampaignOperationalTable>
        <CampaignOperationalTableHeader>
          <CampaignOperationalTableHeaderRow>
            {columns.map((column) => (
              <CampaignOperationalTableHead
                key={column.id}
                className={column.headerClassName}
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
                  if (column.amountCell) {
                    return (
                      <CampaignOperationalTableCellAmount
                        key={column.id}
                        className={column.cellClassName}
                      >
                        {content}
                      </CampaignOperationalTableCellAmount>
                    );
                  }
                  if (column.monoCell) {
                    return (
                      <CampaignOperationalTableCellMono
                        key={column.id}
                        className={column.cellClassName}
                      >
                        {content}
                      </CampaignOperationalTableCellMono>
                    );
                  }
                  return (
                    <CampaignOperationalTableCell
                      key={column.id}
                      className={column.cellClassName}
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
    </div>
  );
}
