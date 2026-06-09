"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { VendorIoRowContextMenu } from "@/features/io/components/vendor-io-row-context-menu";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import type { VendorIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: VendorIoRow[];
  selectedId?: string | null;
  onView: (ioId: string) => void;
  isNavigating?: boolean;
};

function buildVendorIosColumns(
  onView: (ioId: string) => void,
  isNavigating: boolean
): OperationalConfigurableColumnDef<VendorIoRow>[] {
  return [
    {
      id: "io_number",
      label: "IO #",
      monoCell: true,
      renderCell: (row) => <DocumentNumber value={row.document_number} />,
    },
    {
      id: "influencer",
      label: "Influencer",
      renderCell: (row) => row.influencer_name,
    },
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (row) => (
        <Link
          href={`/campaigns/${row.campaign_header_id}`}
          className="text-[11px] text-foreground/90 hover:underline"
        >
          <DocumentNumber value={row.campaign_document_number} /> · {row.campaign_name}
        </Link>
      ),
    },
    {
      id: "assignment",
      label: "Assignment",
      monoCell: true,
      renderCell: (row) => row.assignment_document_number ?? "—",
    },
    {
      id: "amount",
      label: "Amount",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatOperationalAmount(row.amount),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (row) => <IoStatusBadge status={row.status} />,
    },
    {
      id: "sent",
      label: "Sent",
      cellClassName: "text-muted-foreground",
      renderCell: (row) =>
        row.sent_at ? new Date(row.sent_at).toLocaleString() : "—",
    },
    {
      id: "approved",
      label: "Approved",
      cellClassName: "text-muted-foreground",
      renderCell: (row) =>
        row.approved_at ? new Date(row.approved_at).toLocaleString() : "—",
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (row) => (
        <div className="inline-flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView(row.id)}
            disabled={isNavigating}
          >
            View
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/campaigns/${row.campaign_header_id}`}>
              {row.status === "sent" ? "Resend" : "Send"}
            </Link>
          </Button>
          <VendorIoUngenerateTrigger
            row={row}
            disabled={!row.ungenerate_eligible}
            title={row.ungenerate_ineligible_reason ?? undefined}
          />
        </div>
      ),
    },
  ];
}

export const VENDOR_IOS_TABLE_COLUMNS = buildVendorIosColumns(() => {}, false);

export const VENDOR_IOS_TABLE_COLUMN_METAS =
  getOperationalTableColumnMetas(VENDOR_IOS_TABLE_COLUMNS);

export function VendorIosTable({
  rows,
  selectedId = null,
  onView,
  isNavigating = false,
}: Props) {
  const columns = useMemo(
    () => buildVendorIosColumns(onView, isNavigating),
    [onView, isNavigating]
  );

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No vendor IO records found.
      </p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowClassName={(row) => cn(selectedId === row.id && "bg-muted/50")}
      wrapRow={(row, rowElement) => (
        <VendorIoRowContextMenu row={row}>{rowElement}</VendorIoRowContextMenu>
      )}
    />
  );
}
