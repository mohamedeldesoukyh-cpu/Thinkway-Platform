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
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CollectionStatusBadge } from "@/features/billing/components/billing-status-badge";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import type { BillingInvoiceRow, VendorPaymentBatchRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";

type BillingInvoicesTableProps = {
  invoices: BillingInvoiceRow[];
};

export const BILLING_INVOICES_TABLE_COLUMNS: OperationalConfigurableColumnDef<BillingInvoiceRow>[] = [
  {
    id: "invoice",
    label: "Invoice",
    renderCell: (inv) => (
      <Link
        href={`/billing/invoices/${inv.id}`}
        className="text-[11px] font-medium tabular-nums hover:underline"
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
    id: "campaign",
    label: "Campaign",
    cellClassName: "max-w-[140px] truncate text-muted-foreground",
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
    headerClassName: "text-right",
    amountCell: true,
    amountVariant: "revenue",
    renderCell: (inv) => formatBillingMoney(inv.total, inv.currency),
  },
  {
    id: "paid",
    label: "Paid",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (inv) => formatBillingMoney(inv.amount_paid, inv.currency),
  },
  {
    id: "outstanding",
    label: "Outstanding",
    headerClassName: "text-right",
    amountCell: true,
    amountVariant: "revenue",
    renderCell: (inv) => formatBillingMoney(inv.outstanding, inv.currency),
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
          className="bq-foot grid grid-cols-[repeat(5,minmax(0,1fr))_auto] items-center gap-3 px-4 py-2.5 text-[11px]"
        >
          <span>
            Subtotal {code} · {totals.n} invoice{totals.n === 1 ? "" : "s"}
          </span>
          <span className="bq-cc w-fit">{code}</span>
          <span className="bq-n text-right">{formatBillingMoney(totals.t, code)}</span>
          <span className="bq-n text-right">{formatBillingMoney(totals.p, code)}</span>
          <span className={`bq-n text-right ${totals.o > 0 ? "bq-v-neg" : ""}`}>
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

export const BILLING_VENDOR_BATCHES_TABLE_COLUMNS: OperationalConfigurableColumnDef<VendorPaymentBatchRow>[] = [
  {
    id: "batch",
    label: "Batch",
    cellClassName: "tabular-nums",
    renderCell: (batch) => <DocumentNumber value={batch.document_number} />,
  },
  {
    id: "name",
    label: "Name",
    renderCell: (batch) => batch.name,
  },
  {
    id: "date",
    label: "Date",
    renderCell: (batch) => format(new Date(`${batch.batch_date}T00:00:00`), "MMM d, yyyy"),
  },
  {
    id: "amount",
    label: "Amount",
    headerClassName: "text-right",
    amountCell: true,
    amountVariant: "revenue",
    renderCell: (batch) => formatBillingMoney(batch.total_amount, batch.currency),
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize",
    renderCell: (batch) => batch.status,
  },
];

const VENDOR_BATCHES_COLUMNS = BILLING_VENDOR_BATCHES_TABLE_COLUMNS;

export const BILLING_VENDOR_BATCHES_COLUMN_METAS =
  getOperationalTableColumnMetas(BILLING_VENDOR_BATCHES_TABLE_COLUMNS);

type VendorBatchesCardProps = {
  batches: VendorPaymentBatchRow[];
  settingsSlot?: React.ReactNode;
  unpaidVendorCost?: number;
  vendorCost?: number;
  currency?: string;
  mixedCurrency?: boolean;
};

export function VendorBatchesCard({
  batches,
  settingsSlot,
  unpaidVendorCost,
  vendorCost,
  currency,
  mixedCurrency = false,
}: VendorBatchesCardProps) {
  const formatAmount = (amount: number) =>
    mixedCurrency || !currency
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
      : formatBillingMoney(amount, currency);
  const paid =
    vendorCost != null && unpaidVendorCost != null
      ? Math.max(0, vendorCost - unpaidVendorCost)
      : null;

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <CampaignOperationalSectionHeader
          title="Vendor payments"
          description="Payment batches group assignments paid together. Amounts still live on the assignment."
          actions={settingsSlot}
        />
      }
    >
      {vendorCost != null || unpaidVendorCost != null ? (
        <div className="bq-st px-4 py-3">
          {vendorCost != null ? (
            <span>
              <i>Total vendor cost</i>
              <b>{formatAmount(vendorCost)}</b>
            </span>
          ) : null}
          {unpaidVendorCost != null ? (
            <span>
              <i>Unpaid</i>
              <b className={unpaidVendorCost > 0 ? "bad" : undefined}>
                {formatAmount(unpaidVendorCost)}
              </b>
            </span>
          ) : null}
          {paid != null ? (
            <span>
              <i>Paid</i>
              <b>{formatAmount(paid)}</b>
            </span>
          ) : null}
          <span>
            <i>Batches</i>
            <b>{batches.length}</b>
          </span>
        </div>
      ) : null}
      {batches.length === 0 ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">
          No vendor batches recorded. Unpaid vendor cost is still shown above from campaign
          economics — a batch is only created when assignments are paid together.
        </p>
      ) : (
        <OperationalConfigurableTable
          columns={VENDOR_BATCHES_COLUMNS}
          rows={batches}
          rowKey={(batch) => batch.id}
        />
      )}
    </OperationalTableSection>
  );
}
