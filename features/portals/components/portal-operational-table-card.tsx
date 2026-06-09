"use client";

import type { ReactNode } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FilterableValue } from "@/lib/tables/operational-table-filter-sort";

type PortalOperationalTableCardProps<T> = {
  title: string;
  contextLabel: string;
  tableId: string;
  columns: readonly OperationalConfigurableColumnDef<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  filterAccessors?: Partial<Record<string, (row: T) => FilterableValue>>;
  footer?: ReactNode;
  cardContentClassName?: string;
};

export function PortalOperationalTableCard<T>({
  title,
  contextLabel,
  tableId,
  columns,
  rows,
  rowKey,
  emptyMessage,
  filterAccessors,
  footer,
  cardContentClassName,
}: PortalOperationalTableCardProps<T>) {
  return (
    <OperationalTableSuiteProvider
      tableId={tableId}
      columns={columns}
      rows={rows}
      filterAccessors={filterAccessors}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{title}</CardTitle>
          <OperationalTableControlsSlot contextLabel={contextLabel} />
        </CardHeader>
        <CardContent className={cardContentClassName}>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <OperationalConfigurableTable columns={columns} rows={rows} rowKey={rowKey} />
          )}
          {footer}
        </CardContent>
      </Card>
    </OperationalTableSuiteProvider>
  );
}
