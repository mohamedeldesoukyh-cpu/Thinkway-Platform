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
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import type { ClientIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: ClientIoRow[];
  selectedId?: string | null;
  onView: (ioId: string) => void;
  isNavigating?: boolean;
};

function buildClientIosColumns(
  onView: (ioId: string) => void,
  isNavigating: boolean
): OperationalConfigurableColumnDef<ClientIoRow>[] {
  return [
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
      id: "client",
      label: "Client",
      renderCell: (row) => row.client_name,
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
        </div>
      ),
    },
  ];
}

export const CLIENT_IOS_TABLE_COLUMNS = buildClientIosColumns(() => {}, false);

export const CLIENT_IOS_TABLE_COLUMN_METAS =
  getOperationalTableColumnMetas(CLIENT_IOS_TABLE_COLUMNS);

export function ClientIosTable({
  rows,
  selectedId = null,
  onView,
  isNavigating = false,
}: Props) {
  const columns = useMemo(
    () => buildClientIosColumns(onView, isNavigating),
    [onView, isNavigating]
  );

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No client IO records found.
      </p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowClassName={(row) => cn(selectedId === row.id && "bg-muted/50")}
    />
  );
}
