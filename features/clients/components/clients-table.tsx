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
import { clientDetailPath } from "@/lib/routing/entity-paths";

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
      <Link href={clientDetailPath(client)} className="platform-v6-link">
        <DocumentNumber value={client.document_number} />
      </Link>
    ),
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
            href={clientDetailPath(client)}
            className="platform-v6-link font-semibold"
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
      <span className="block truncate platform-v6-c-gray">
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
    renderCell: (client) => {
      const email = client.billing_email?.trim();
      if (!email) {
        return <span className="block truncate platform-v6-c-gray">—</span>;
      }
      return <span className="block truncate text-[11px]">{email}</span>;
    },
  },
  {
    id: "created",
    label: "Created",
    colWidth: "112px",
    renderCell: (client) => format(new Date(client.created_at), "MMM d, yyyy"),
    cellClassName: "whitespace-nowrap platform-v6-c-gray text-[11px]",
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
