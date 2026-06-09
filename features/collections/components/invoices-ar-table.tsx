"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { Badge } from "@/components/ui/badge";
import { AGING_BUCKET_LABELS, bucketSeverity } from "@/lib/collections/aging";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";
import { cn } from "@/lib/utils";

type InvoicesArTableProps = {
  invoices: CollectionInvoiceRow[];
  currency: AnalyticsCurrencyContext;
  filter?: "all" | "overdue";
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Unpaid",
  partial: "Partially paid",
  collected: "Paid",
  overdue: "Overdue",
  written_off: "Written off",
  disputed: "Disputed",
};

function buildInvoicesArColumns(
  format: (n: number) => string
): OperationalConfigurableColumnDef<CollectionInvoiceRow>[] {
  return [
    {
      id: "invoice",
      label: "Invoice",
      renderCell: (inv) => (
        <Link
          href={`/billing/invoices/${inv.id}`}
          className="text-[11px] text-primary tabular-nums hover:underline"
        >
          <DocumentNumber value={inv.document_number} showCanonicalTitle={false} />
        </Link>
      ),
    },
    {
      id: "client",
      label: "Client",
      cellClassName: "max-w-[140px] truncate",
      renderCell: (inv) => inv.client_name,
    },
    {
      id: "status",
      label: "Status",
      renderCell: (inv) => (
        <Badge variant="outline">
          {STATUS_LABEL[inv.collection_status] ?? inv.collection_status}
        </Badge>
      ),
    },
    {
      id: "aging",
      label: "Aging",
      renderCell: (inv) => {
        const severity = bucketSeverity(inv.aging_bucket);
        return (
          <span
            className={cn(
              "text-[11px]",
              severity === "danger" && "text-red-600",
              severity === "warn" && "text-amber-600"
            )}
          >
            {AGING_BUCKET_LABELS[inv.aging_bucket]}
          </span>
        );
      },
    },
    {
      id: "outstanding",
      label: "Outstanding",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (inv) => format(inv.outstanding),
    },
  ];
}

const INVOICES_AR_TABLE_COLUMNS = buildInvoicesArColumns(() => "—");

export const INVOICES_AR_TABLE_COLUMN_METAS =
  getOperationalTableColumnMetas(INVOICES_AR_TABLE_COLUMNS);

export function InvoicesArTable({
  invoices,
  currency,
  filter = "all",
}: InvoicesArTableProps) {
  const rows =
    filter === "overdue"
      ? invoices.filter((i) => i.aging_bucket !== "current" && i.outstanding > 0)
      : invoices.filter((i) => i.outstanding > 0);

  const format = (n: number) => formatAnalyticsAmount(n, currency, { decimals: 0 });

  const columns = useMemo(() => buildInvoicesArColumns(format), [currency]);

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No open receivables in this view.
      </p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={columns}
      rows={rows}
      rowKey={(inv) => inv.id}
    />
  );
}
