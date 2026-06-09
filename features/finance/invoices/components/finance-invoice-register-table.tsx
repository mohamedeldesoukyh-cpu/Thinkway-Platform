"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo } from "react";

import { InvoiceStatusBadge } from "@/components/finance/invoice-status-badge";
import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { InvoiceUngenerateTrigger } from "@/features/finance/invoices/components/invoice-ungenerate-dialog";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import {
  invoiceUngenerateIneligibleReason,
  isInvoiceUngenerateEligible,
} from "@/lib/billing/invoice-ungenerate-eligibility";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { cn } from "@/lib/utils";

type FinanceInvoiceRegisterTableProps = {
  rows: FinanceInvoiceRegisterRow[];
  showUngenerate?: boolean;
  /** When set, invoice numbers open the campaign detail drawer instead of navigating away. */
  onOpenDetail?: (row: FinanceInvoiceRegisterRow) => void;
};

function formatRegisterDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

const FINANCE_INVOICE_REGISTER_BASE_COLUMNS: OperationalConfigurableColumnDef<FinanceInvoiceRegisterRow>[] =
  [
    {
      id: "invoice_number",
      label: "Invoice number",
      renderCell: () => null,
    },
    {
      id: "client",
      label: "Client",
      renderCell: (row) => row.client_name,
    },
    {
      id: "brand",
      label: "Brand",
      renderCell: (row) => row.brand_name ?? "—",
    },
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (row) =>
        row.campaign_name ? (
          <div>
            {row.campaign_document_number ? (
              <p className="text-[11px] tabular-nums text-muted-foreground">
                <DocumentNumber value={row.campaign_document_number} />
              </p>
            ) : null}
            <p className="max-w-[160px] truncate font-medium">{row.campaign_name}</p>
          </div>
        ) : (
          "—"
        ),
    },
    {
      id: "revenue_before_vat",
      label: "Rev. before VAT",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatOperationalAmount(row.revenue_before_vat),
    },
    {
      id: "vat",
      label: "VAT",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatOperationalAmount(row.vat_amount),
    },
    {
      id: "revenue_after_vat",
      label: "Rev. after VAT",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatOperationalAmount(row.revenue_after_vat),
    },
    {
      id: "invoice_status",
      label: "Invoice status",
      renderCell: (row) => (
        <InvoiceStatusBadge status={row.status} regeneration_status={row.regeneration_status} />
      ),
    },
    {
      id: "locked",
      label: "Locked",
      renderCell: (row) => (
        <Badge
          variant={row.locked_status === "Locked" ? "secondary" : "outline"}
          className="text-[10px]"
        >
          {row.locked_status}
        </Badge>
      ),
    },
    {
      id: "created",
      label: "Created",
      cellClassName: "text-muted-foreground",
      renderCell: (row) => formatRegisterDate(row.created_date),
    },
  ];

const FINANCE_INVOICE_REGISTER_ACTIONS_COLUMN: OperationalConfigurableColumnDef<FinanceInvoiceRegisterRow> =
  {
    id: "actions",
    label: "Actions",
    locked: true,
    headerClassName: "w-[100px]",
    renderCell: (row) =>
      isInvoiceUngenerateEligible(row) ? (
        <InvoiceUngenerateTrigger invoiceId={row.id} documentNumber={row.document_number} />
      ) : (
        <span
          className="text-[10px] text-muted-foreground"
          title={invoiceUngenerateIneligibleReason(row) ?? "Not eligible"}
        >
          —
        </span>
      ),
  };

function onOpenDetailCell(
  row: FinanceInvoiceRegisterRow,
  onOpenDetail: FinanceInvoiceRegisterTableProps["onOpenDetail"]
) {
  if (onOpenDetail) {
    return (
      <button
        type="button"
        onClick={() => onOpenDetail(row)}
        className="text-[11px] font-medium tabular-nums transition-colors hover:text-primary hover:underline"
      >
        <DocumentNumber value={row.document_number} />
      </button>
    );
  }

  return (
    <Link
      href={`/billing/invoices/${row.id}`}
      className="text-[11px] font-medium tabular-nums hover:underline"
    >
      <DocumentNumber value={row.document_number} />
    </Link>
  );
}

function buildFinanceInvoiceRegisterColumns(
  onOpenDetail?: FinanceInvoiceRegisterTableProps["onOpenDetail"],
  showUngenerate = false
): OperationalConfigurableColumnDef<FinanceInvoiceRegisterRow>[] {
  const columns = FINANCE_INVOICE_REGISTER_BASE_COLUMNS.map((column) =>
    column.id === "invoice_number"
      ? {
          ...column,
          renderCell: (row: FinanceInvoiceRegisterRow) => onOpenDetailCell(row, onOpenDetail),
        }
      : column
  );

  if (showUngenerate) {
    return [...columns, FINANCE_INVOICE_REGISTER_ACTIONS_COLUMN];
  }

  return columns;
}

export function getFinanceInvoiceRegisterColumnMetas(
  showUngenerate = false
): OperationalTableColumnMeta[] {
  return getOperationalTableColumnMetas(
    buildFinanceInvoiceRegisterColumns(undefined, showUngenerate)
  );
}

export const FINANCE_INVOICE_REGISTER_COLUMN_METAS = getFinanceInvoiceRegisterColumnMetas(false);
export const FINANCE_INVOICE_REGISTER_COLUMN_METAS_WITH_ACTIONS =
  getFinanceInvoiceRegisterColumnMetas(true);

export function FinanceInvoiceRegisterTable({
  rows,
  showUngenerate = false,
  onOpenDetail,
}: FinanceInvoiceRegisterTableProps) {
  const columns = useMemo(
    () => buildFinanceInvoiceRegisterColumns(onOpenDetail, showUngenerate),
    [onOpenDetail, showUngenerate]
  );

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No invoices in the register yet.
      </p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowClassName={(row) =>
        cn(row.regeneration_status === "pending_regeneration" && "opacity-50")
      }
    />
  );
}
