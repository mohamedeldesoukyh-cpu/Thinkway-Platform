"use client";

import Link from "next/link";
import "./client-ios-table.css";
import { useMemo, useSyncExternalStore } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import type { ClientIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

type ClientIosTableContext = {
  onView: (ioId: string) => void;
  isNavigating: boolean;
  showClientColumn: boolean;
  platformV6: boolean;
};

type Props = {
  rows: ClientIoRow[];
  selectedId?: string | null;
  onView: (ioId: string) => void;
  isNavigating?: boolean;
  /** Hide client column when scoped to a single client workspace. */
  showClientColumn?: boolean;
  platformV6?: boolean;
};

const subscribeToLocalDate = () => () => {};
const localDateReady = () => true;
const serverDateReady = () => false;

function ClientIoLocalDate({ value }: { value: string | null }) {
  const ready = useSyncExternalStore(subscribeToLocalDate, localDateReady, serverDateReady);
  if (!value) return <>—</>;
  return <time dateTime={value} className="client-io-date">
    <span>{ready ? new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "…"}</span>
    <span>{ready ? new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : ""}</span>
  </time>;
}

function renderClientIoStatusBadge(
  status: ClientIoRow["status"],
  platformV6: boolean
) {
  if (platformV6 && status === "draft") {
    return (
      <span className={platformV6BadgeClass("gray")}>Draft</span>
    );
  }
  return <IoStatusBadge status={status} />;
}

function buildClientIosColumns(
  context: ClientIosTableContext
): OperationalConfigurableColumnDef<ClientIoRow>[] {
  const { onView, isNavigating, showClientColumn, platformV6 } = context;
  const columns: OperationalConfigurableColumnDef<ClientIoRow>[] = [
    {
      id: "io_number",
      colWidth: "120px",
      label: "IO #",
      monoCell: true,
      renderCell: (row) => (
        <span className={cn(platformV6 && "tabular-nums text-[var(--tw-text-2)]")}>
          <DocumentNumber value={row.document_number} />
        </span>
      ),
    },
    {
      id: "campaign",
      colWidth: "320px",
      label: "Campaign",
      renderCell: (row) => (
        <Link
          href={`/campaigns/${row.campaign_header_id}`}
          className={cn("client-io-campaign", platformV6 && "platform-v6-link")}
        >
          <span className="client-io-reference"><DocumentNumber value={row.campaign_document_number} /></span>
          <span>{row.campaign_name}</span>
        </Link>
      ),
    },
  ];

  if (showClientColumn) {
    columns.push({
      id: "client",
      colWidth: "220px",
      label: "Client",
      renderCell: (row) => <span className="client-io-name">{row.client_name}</span>,
    });
  }

  columns.push(
    {
      id: "status",
      colWidth: "150px",
      label: "Status",
      renderCell: (row) => renderClientIoStatusBadge(row.status, platformV6),
    },
    {
      id: "sent",
      colWidth: "130px",
      label: "Sent",
      cellClassName: platformV6 ? "text-[var(--tw-text-3)]" : "text-muted-foreground",
      renderCell: (row) => <ClientIoLocalDate value={row.sent_at} />,
    },
    {
      id: "approved",
      colWidth: "130px",
      label: "Approved",
      cellClassName: platformV6 ? "text-[var(--tw-text-3)]" : "text-muted-foreground",
      renderCell: (row) => <ClientIoLocalDate value={row.approved_at} />,
    },
    {
      id: "actions",
      colWidth: "150px",
      label: "Actions",
      locked: true,
      headerClassName: platformV6 ? undefined : "text-right",
      cellClassName: platformV6 ? undefined : "text-right",
      renderCell: (row) => {
        const sendHref = `/campaigns/${row.campaign_header_id}?tab=client-io`;
        const sendLabel =
          row.status === "sent" || row.status === "approved" ? "Resend" : "Send";

        if (platformV6) {
          return (
            <div className="platform-v6-row-actions !justify-start">
              <button
                type="button"
                className="platform-v6-link"
                onClick={() => onView(row.id)}
                disabled={isNavigating}
              >
                View
              </button>
              <Link href={sendHref} className="platform-v6-link">
                {sendLabel}
              </Link>
            </div>
          );
        }

        return (
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
              <Link href={sendHref}>{sendLabel}</Link>
            </Button>
          </div>
        );
      },
    }
  );

  return columns;
}

export const CLIENT_IOS_TABLE_COLUMNS = buildClientIosColumns({
  onView: () => {},
  isNavigating: false,
  showClientColumn: true,
  platformV6: false,
});

export const CLIENT_IOS_TABLE_COLUMN_METAS =
  getOperationalTableColumnMetas(CLIENT_IOS_TABLE_COLUMNS);

export function ClientIosTable({
  rows,
  selectedId = null,
  onView,
  isNavigating = false,
  showClientColumn = true,
  platformV6 = false,
}: Props) {
  const columns = useMemo(
    () =>
      buildClientIosColumns({
        onView,
        isNavigating,
        showClientColumn,
        platformV6,
      }),
    [onView, isNavigating, showClientColumn, platformV6]
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
      className={cn("client-io-register-table", platformV6 && "platform-v6-data-table")}
      rowClassName={(row) =>
        cn(!platformV6 && selectedId === row.id && "bg-muted/50")
      }
    />
  );
}
