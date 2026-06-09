"use client";

import { format } from "date-fns";
import { useMemo } from "react";

import { AdjustmentLifecycleButtons } from "@/features/finance/adjustments/components/adjustment-lifecycle-buttons";
import { AdjustmentStatusBadge } from "@/components/finance/adjustment-status-badge";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import type { FinanceAdjustmentRegisterRow } from "@/features/finance/adjustments/types";
import type { AdjustmentTableKind } from "@/lib/finance/adjustment-table-config";
import { formatMoney } from "@/features/campaigns/utils";

type AdjustmentRegisterTableProps = {
  rows: FinanceAdjustmentRegisterRow[];
  kind: AdjustmentTableKind;
};

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

const ADJUSTMENT_REGISTER_COLUMNS: OperationalConfigurableColumnDef<FinanceAdjustmentRegisterRow>[] =
  [
    {
      id: "document",
      label: "Document",
      monoCell: true,
      renderCell: (row) => row.document_number,
    },
    {
      id: "source",
      label: "Source",
      monoCell: true,
      renderCell: (row) => row.source_document_number ?? "—",
    },
    {
      id: "party",
      label: "Client / Vendor",
      renderCell: (row) => row.client_name ?? row.vendor_name ?? "—",
    },
    {
      id: "campaign",
      label: "Campaign",
      monoCell: true,
      renderCell: (row) => row.campaign_document_number ?? "—",
    },
    {
      id: "date",
      label: "Date",
      renderCell: (row) => formatDate(row.issue_date),
    },
    {
      id: "amount",
      label: "Amount",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatMoney(row.amount_after_vat, row.currency),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (row) => <AdjustmentStatusBadge status={row.status} />,
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      renderCell: () => null,
    },
  ];

export const ADJUSTMENT_REGISTER_COLUMN_METAS =
  getOperationalTableColumnMetas(ADJUSTMENT_REGISTER_COLUMNS);

export function AdjustmentRegisterTable({ rows, kind }: AdjustmentRegisterTableProps) {
  const columns = useMemo(
    () =>
      ADJUSTMENT_REGISTER_COLUMNS.map((column) =>
        column.id === "actions"
          ? {
              ...column,
              renderCell: (row: FinanceAdjustmentRegisterRow) => (
                <AdjustmentLifecycleButtons kind={kind} id={row.id} status={row.status} />
              ),
            }
          : column
      ),
    [kind]
  );

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No documents in this register yet.
      </p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
    />
  );
}
