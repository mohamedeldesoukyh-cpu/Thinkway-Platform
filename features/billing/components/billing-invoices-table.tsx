"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { ReactNode } from "react";

import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CollectionStatusBadge } from "@/features/billing/components/billing-status-badge";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
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
      inv.due_date ? format(new Date(`${inv.due_date}T00:00:00`), "MMM d, yyyy") : "—",
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
  if (invoices.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">No invoices issued yet.</p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={BILLING_INVOICES_COLUMNS}
      rows={invoices}
      rowKey={(inv) => inv.id}
    />
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
};

export function VendorBatchesCard({ batches, settingsSlot }: VendorBatchesCardProps) {
  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <CampaignOperationalSectionHeader
          title="Vendor payment batches"
          actions={settingsSlot}
        />
      }
    >
      {batches.length === 0 ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">No vendor batches recorded.</p>
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
