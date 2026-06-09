"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo } from "react";
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
import { AGING_BUCKET_LABELS } from "@/features/billing/constants";
import type { BillingInvoiceRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";

type CollectionTrackerProps = {
  invoices: BillingInvoiceRow[];
  currency?: string;
  settingsSlot?: ReactNode;
};

function buildCollectionTrackerColumns(
  currency: string
): OperationalConfigurableColumnDef<BillingInvoiceRow>[] {
  return [
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
      id: "due_date",
      label: "Due date",
      renderCell: (inv) =>
        inv.due_date ? format(new Date(`${inv.due_date}T00:00:00`), "MMM d, yyyy") : "—",
    },
    {
      id: "aging",
      label: "Aging",
      renderCell: (inv) => AGING_BUCKET_LABELS[inv.aging_bucket],
    },
    {
      id: "outstanding",
      label: "Outstanding",
      headerClassName: "text-right",
      amountCell: true,
      cellClassName: "font-medium",
      renderCell: (inv) => formatBillingMoney(inv.outstanding, inv.currency || currency),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (inv) => <CollectionStatusBadge status={inv.collection_status} />,
    },
  ];
}

export const BILLING_COLLECTION_TRACKER_TABLE_COLUMNS = buildCollectionTrackerColumns("USD");

export const BILLING_COLLECTION_TRACKER_COLUMN_METAS = getOperationalTableColumnMetas(
  BILLING_COLLECTION_TRACKER_TABLE_COLUMNS
);

export function CollectionTracker({
  invoices,
  currency = "USD",
  settingsSlot,
}: CollectionTrackerProps) {
  const open = useMemo(() => invoices.filter((i) => i.outstanding > 0), [invoices]);
  const columns = useMemo(() => buildCollectionTrackerColumns(currency), [currency]);

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <CampaignOperationalSectionHeader
          title="Collection tracker"
          description={`${open.length} open invoice${open.length === 1 ? "" : "s"} requiring collection follow-up`}
          actions={settingsSlot}
        />
      }
    >
      {open.length === 0 ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">All invoices collected.</p>
      ) : (
        <OperationalConfigurableTable
          columns={columns}
          rows={open}
          rowKey={(inv) => inv.id}
        />
      )}
    </OperationalTableSection>
  );
}
