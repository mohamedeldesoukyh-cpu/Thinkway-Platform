"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo } from "react";

import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import { CollectionStatusBadge } from "@/features/billing/components/billing-status-badge";
import type { BillingInvoiceRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";

type BillingInvoicesTableProps = {
  invoices: BillingInvoiceRow[];
};

export const BILLING_INVOICES_TABLE_COLUMNS: OperationalConfigurableColumnDef<BillingInvoiceRow>[] = [
  {
    id: "invoice",
    label: "Invoice",
    renderCell: (inv) => (
      <Link href={`/billing/invoices/${inv.id}`} className="hover:underline">
        <DocumentNumber value={inv.document_number} showCanonicalTitle={false} />
      </Link>
    ),
  },
  {
    id: "client",
    label: "Client",
    cellClassName: "whitespace-normal break-words",
    renderCell: (inv) => inv.client_name,
  },
  {
    id: "campaign_no",
    label: "Campaign No",
    renderCell: (inv) => (
      <DocumentNumber value={inv.campaign_document_number} showCanonicalTitle={false} />
    ),
  },
  {
    id: "campaign",
    label: "Campaign",
    cellClassName: "whitespace-normal break-words",
    renderCell: (inv) => inv.campaign_name ?? "—",
  },
  {
    id: "issue_date",
    label: "Issue date",
    renderCell: (inv) => format(new Date(`${inv.issue_date}T00:00:00`), "MMM d, yyyy"),
  },
  {
    id: "due_date",
    label: "Due date",
    renderCell: (inv) =>
      inv.due_date ? (
        format(new Date(`${inv.due_date}T00:00:00`), "MMM d, yyyy")
      ) : (
        <span className="italic text-muted-foreground">not set</span>
      ),
  },
  {
    id: "currency",
    label: "Ccy",
    renderCell: (inv) => <span className="bq-cc">{inv.currency}</span>,
  },
  {
    id: "total",
    label: "Total",
    renderCell: (inv) => formatBillingMoney(inv.total, inv.currency),
  },
  {
    id: "paid",
    label: "Paid",
    renderCell: (inv) => formatBillingMoney(inv.amount_paid, inv.currency),
  },
  {
    id: "outstanding",
    label: "Outstanding",
    renderCell: (inv) => (
      <span className={inv.outstanding > 0 ? "bq-v-neg" : undefined}>
        {formatBillingMoney(inv.outstanding, inv.currency)}
      </span>
    ),
  },
  {
    id: "collection",
    label: "Collection",
    renderCell: (inv) => <CollectionStatusBadge status={inv.collection_status} />,
  },
];

const BILLING_INVOICES_COLUMNS = BILLING_INVOICES_TABLE_COLUMNS;

export const BILLING_INVOICES_COLUMN_METAS = getOperationalTableColumnMetas(BILLING_INVOICES_TABLE_COLUMNS);

export function BillingInvoicesTable({ invoices }: BillingInvoicesTableProps) {
  const displayInvoices =
    useOperationalTableDataContextOptional<BillingInvoiceRow>()?.processedRows ?? invoices;

  const byCurrency = useMemo(() => {
    const map = new Map<string, { n: number; t: number; p: number; o: number }>();
    for (const inv of displayInvoices) {
      const entry = map.get(inv.currency) ?? { n: 0, t: 0, p: 0, o: 0 };
      entry.n += 1;
      entry.t += inv.total;
      entry.p += inv.amount_paid;
      entry.o += inv.outstanding;
      map.set(inv.currency, entry);
    }
    return [...map.entries()];
  }, [displayInvoices]);

  const missingDue = displayInvoices.filter((inv) => !inv.due_date).length;

  if (invoices.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">No invoices issued yet.</p>
    );
  }

  return (
    <div>
      <OperationalConfigurableTable
        columns={BILLING_INVOICES_COLUMNS}
        rows={invoices}
        rowKey={(inv) => inv.id}
        rowClassName={(inv) => (inv.outstanding > 0 ? "shadow-[inset_3px_0_0_#c82121]" : undefined)}
      />
      {byCurrency.map(([code, totals]) => (
        <div
          key={code}
          className="bq-foot grid grid-cols-[repeat(5,minmax(0,1fr))_auto] items-center gap-3 px-4 py-2.5"
        >
          <span>
            Subtotal {code} · {totals.n} invoice{totals.n === 1 ? "" : "s"}
          </span>
          <span className="bq-cc w-fit">{code}</span>
          <span className="bq-n">{formatBillingMoney(totals.t, code)}</span>
          <span className="bq-n">{formatBillingMoney(totals.p, code)}</span>
          <span className={`bq-n ${totals.o > 0 ? "bq-v-neg" : ""}`}>
            {formatBillingMoney(totals.o, code)}
          </span>
        </div>
      ))}
      <p className="bq-tn">
        Subtotals are per currency and never added together.
        {missingDue
          ? ` ${missingDue} of ${displayInvoices.length} invoices carry no due date, so they cannot be aged.`
          : null}
      </p>
    </div>
  );
}

