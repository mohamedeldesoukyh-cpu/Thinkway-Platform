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

import { ClientStatusBadge } from "./client-status-badge";
import { OnboardingStatusBadge } from "./onboarding-status-badge";
import { isClientOnboardingStatus } from "@/lib/clients/onboarding-status";

type ClientsTableProps = {
  clients: ClientsListResult["clients"];
};

type ClientRow = ClientsListResult["clients"][number];

export const CLIENTS_TABLE_COLUMNS: OperationalConfigurableColumnDef<ClientRow>[] = [
  {
    id: "document_number",
    label: "Client #",
    monoCell: true,
    renderCell: (client) => <DocumentNumber value={client.document_number} />,
  },
  {
    id: "legal_entity",
    label: "Legal entity",
    renderCell: (client) => {
      const legalName = client.legal_name?.trim();
      const showLegalSubtitle =
        Boolean(legalName) &&
        legalName!.toLowerCase() !== client.name.trim().toLowerCase();

      return (
        <div className="flex flex-col">
          <Link
            href={`/clients/${client.id}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {client.name}
          </Link>
          {showLegalSubtitle ? (
            <span className="text-[11px] text-muted-foreground">{legalName}</span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "group",
    label: "Group",
    renderCell: (client) => client.group?.name ?? "—",
  },
  {
    id: "status",
    label: "Status",
    renderCell: (client) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <ClientStatusBadge status={client.status} />
        {"onboarding_status" in client &&
        client.onboarding_status &&
        isClientOnboardingStatus(client.onboarding_status) ? (
          <OnboardingStatusBadge status={client.onboarding_status} />
        ) : null}
      </div>
    ),
  },
  {
    id: "billing_email",
    label: "Billing email",
    renderCell: (client) => client.billing_email ?? "—",
    cellClassName: "text-muted-foreground",
  },
  {
    id: "created",
    label: "Created",
    renderCell: (client) => format(new Date(client.created_at), "MMM d, yyyy"),
    cellClassName: "text-muted-foreground",
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
