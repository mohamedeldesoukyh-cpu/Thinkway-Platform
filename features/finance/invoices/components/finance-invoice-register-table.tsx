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
  /** Campaign workspace styling (reference HTML data-table). */
  appearance?: "default" | "campaign";
};

function formatRegisterDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

function campaignInvoiceColumnLabel(
  id: string,
  defaultLabel: string,
  appearance: "default" | "campaign"
): string {
  if (appearance !== "campaign") return defaultLabel;
  if (id === "invoice_number") return "Invoice #";
  if (id === "invoice_status") return "Status";
  return defaultLabel;
}

function buildFinanceInvoiceRegisterBaseColumns(
  appearance: "default" | "campaign"
): OperationalConfigurableColumnDef<FinanceInvoiceRegisterRow>[] {
  return [
    {
      id: "invoice_number",
      label: campaignInvoiceColumnLabel("invoice_number", "Invoice number", appearance),
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
      renderCell: (row) =>
        row.brand_name ? (
          <span className={appearance === "campaign" ? undefined : "fs-br"}>
            {row.brand_name}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (row) =>
        row.campaign_name ? (
          <div>
            {row.campaign_document_number ? (
              <p
                className={cn(
                  "text-[11px] tabular-nums",
                  appearance === "campaign"
                    ? "text-[var(--camp-blue)]"
                    : "text-muted-foreground"
                )}
              >
                <DocumentNumber value={row.campaign_document_number} />
              </p>
            ) : null}
            <p
              className={cn(
                "max-w-[160px] whitespace-normal break-words",
                appearance === "campaign"
                  ? "text-[10px] text-[var(--camp-text-3)]"
                  : "fs-nm"
              )}
            >
              {row.campaign_name}
            </p>
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
      label: campaignInvoiceColumnLabel("invoice_status", "Invoice status", appearance),
      renderCell: (row) => (
        <InvoiceStatusBadge
          status={row.status}
          regeneration_status={row.regeneration_status}
          metadata={row.metadata}
          appearance={appearance}
        />
      ),
    },
    {
      id: "locked",
      label: "Locked",
      renderCell: (row) =>
        appearance === "campaign" ? (
          <span className="text-[11px]">{row.locked_status}</span>
        ) : (
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
      cellClassName:
        appearance === "campaign"
          ? "text-[11px] text-[var(--camp-text-3)]"
          : "text-muted-foreground",
      renderCell: (row) => formatRegisterDate(row.created_date),
    },
  ];
}

function buildFinanceInvoiceRegisterActionsColumn(
  appearance: "default" | "campaign"
): OperationalConfigurableColumnDef<FinanceInvoiceRegisterRow> {
  return {
    id: "actions",
    label: "Actions",
    locked: true,
    headerClassName: "w-[100px]",
    renderCell: (row) =>
      isInvoiceUngenerateEligible(row) ? (
        <InvoiceUngenerateTrigger
          invoiceId={row.id}
          documentNumber={row.document_number}
          variant={appearance === "campaign" ? "link" : "button"}
        />
      ) : (
        <span
          className="text-[10px] text-muted-foreground"
          title={invoiceUngenerateIneligibleReason(row) ?? "Not eligible"}
        >
          —
        </span>
      ),
  };
}

function onOpenDetailCell(
  row: FinanceInvoiceRegisterRow,
  onOpenDetail: FinanceInvoiceRegisterTableProps["onOpenDetail"],
  appearance: "default" | "campaign"
) {
  if (onOpenDetail) {
    return (
      <button
        type="button"
        onClick={() => onOpenDetail(row)}
        className={cn(
          "text-[11px] font-medium tabular-nums transition-colors hover:underline",
          appearance === "campaign"
            ? "thinkway-campaign-link-btn"
            : "hover:text-primary"
        )}
      >
        <DocumentNumber value={row.document_number} />
      </button>
    );
  }

  return (
    <Link
      href={`/billing/invoices/${row.id}`}
      className={cn(
        "text-[11px] font-medium tabular-nums hover:underline",
        appearance === "campaign" && "thinkway-campaign-link"
      )}
    >
      <DocumentNumber value={row.document_number} />
    </Link>
  );
}

function buildFinanceInvoiceRegisterColumns(
  onOpenDetail?: FinanceInvoiceRegisterTableProps["onOpenDetail"],
  showUngenerate = false,
  appearance: "default" | "campaign" = "default"
): OperationalConfigurableColumnDef<FinanceInvoiceRegisterRow>[] {
  const columns = buildFinanceInvoiceRegisterBaseColumns(appearance).map((column) =>
    column.id === "invoice_number"
      ? {
          ...column,
          renderCell: (row: FinanceInvoiceRegisterRow) =>
            onOpenDetailCell(row, onOpenDetail, appearance),
        }
      : column
  );

  if (showUngenerate) {
    return [...columns, buildFinanceInvoiceRegisterActionsColumn(appearance)];
  }

  return columns;
}

export function getFinanceInvoiceRegisterColumnMetas(
  showUngenerate = false,
  appearance: "default" | "campaign" = "default"
): OperationalTableColumnMeta[] {
  return getOperationalTableColumnMetas(
    buildFinanceInvoiceRegisterColumns(undefined, showUngenerate, appearance)
  );
}

export const FINANCE_INVOICE_REGISTER_COLUMN_METAS = getFinanceInvoiceRegisterColumnMetas(false);
export const FINANCE_INVOICE_REGISTER_COLUMN_METAS_WITH_ACTIONS =
  getFinanceInvoiceRegisterColumnMetas(true);

export function FinanceInvoiceRegisterTable({
  rows,
  showUngenerate = false,
  onOpenDetail,
  appearance = "default",
}: FinanceInvoiceRegisterTableProps) {
  const columns = useMemo(
    () => buildFinanceInvoiceRegisterColumns(onOpenDetail, showUngenerate, appearance),
    [onOpenDetail, showUngenerate, appearance]
  );

  if (rows.length === 0) {
    return appearance === "campaign" ? (
      <div className="thinkway-campaign-empty-state">
        <p>No invoices in the register yet.</p>
      </div>
    ) : (
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
        cn(
          row.regeneration_status === "pending_regeneration" && "opacity-50",
          appearance !== "campaign" &&
            row.status.toLowerCase() !== "paid" &&
            "fs-row-warn"
        )
      }
    />
  );
}
