"use client";

import Link from "next/link";
import { format } from "date-fns";

import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import type { ClientsListResult } from "@/features/clients/queries";

import { ClientListStatusCell } from "./client-list-status-cell";

type ClientsTableProps = {
  clients: ClientsListResult["clients"];
};

type ClientRow = ClientsListResult["clients"][number];

export const CLIENTS_TABLE_COLUMNS: OperationalConfigurableColumnDef<ClientRow>[] = [
  {
    id: "document_number",
    label: "Client #",
    colWidth: "96px",
    monoCell: true,
    renderCell: (client) => (
      <Link
        href={`/clients/${client.id}`}
        className="text-muted-foreground hover:text-foreground hover:underline"
      >
        <DocumentNumber value={client.document_number} />
      </Link>
    ),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "legal_entity",
    label: "Legal entity",
    colWidth: "24%",
    renderCell: (client) => {
      const legalName = client.legal_name?.trim();
      const showLegalSubtitle =
        Boolean(legalName) &&
        legalName!.toLowerCase() !== client.name.trim().toLowerCase();

      return (
        <div className="min-w-0 flex flex-col gap-0.5">
          <Link
            href={`/clients/${client.id}`}
            className="truncate font-medium text-foreground hover:text-primary hover:underline"
          >
            {client.name}
          </Link>
          {showLegalSubtitle ? (
            <span className="truncate text-[11px] text-muted-foreground">{legalName}</span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "group",
    label: "Group",
    colWidth: "16%",
    renderCell: (client) => (
      <span className="block truncate text-muted-foreground">
        {client.group?.name ?? "—"}
      </span>
    ),
  },
  {
    id: "status",
    label: "Status",
    colWidth: "18%",
    renderCell: (client) => (
      <ClientListStatusCell
        status={client.status}
        onboardingStatus={client.onboarding_status}
      />
    ),
  },
  {
    id: "billing_email",
    label: "Billing email",
    colWidth: "20%",
    renderCell: (client) => (
      <span className="block truncate">{client.billing_email ?? "—"}</span>
    ),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "created",
    label: "Created",
    colWidth: "112px",
    renderCell: (client) => format(new Date(client.created_at), "MMM d, yyyy"),
    cellClassName: "whitespace-nowrap text-muted-foreground",
  },
];

export const CLIENTS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(CLIENTS_TABLE_COLUMNS);

export function ClientsTable({ clients }: ClientsTableProps) {
  return (
    <OperationalConfigurableTable
      columns={CLIENTS_TABLE_COLUMNS}
      rows={clients}
      rowKey={(client) => client.id}
    />
  );
}
