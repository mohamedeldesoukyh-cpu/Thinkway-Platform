"use client";

import {
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { PortalOperationalTableCard } from "@/features/portals/components/portal-operational-table-card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import {
  formatPortalCurrency,
  formatPortalDate,
} from "@/features/portals/components/portal-table-utils";
import type { ClientInvoiceRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { PORTAL_CLIENT_INVOICES_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const CLIENT_INVOICES_COLUMNS: OperationalConfigurableColumnDef<ClientInvoiceRow>[] = [
  {
    id: "invoice",
    label: "Invoice",
    monoCell: true,
    renderCell: (row) => <DocumentNumber value={row.document_number} />,
  },
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => row.campaign_name ?? "—",
  },
  {
    id: "issue_date",
    label: "Issue date",
    renderCell: (row) => formatPortalDate(row.issue_date),
  },
  {
    id: "due_date",
    label: "Due date",
    renderCell: (row) => formatPortalDate(row.due_date),
  },
  {
    id: "total",
    label: "Total",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.amount_total, row.currency),
  },
  {
    id: "paid",
    label: "Paid",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.amount_paid, row.currency),
  },
  {
    id: "pending",
    label: "Pending",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.amount_pending, row.currency),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => <PortalStatusBadge value={row.status} />,
  },
];

export const CLIENT_INVOICES_COLUMN_METAS = getOperationalTableColumnMetas(CLIENT_INVOICES_COLUMNS);

export function ClientInvoicesTable({ rows }: { rows: ClientInvoiceRow[] }) {
  return (
    <PortalOperationalTableCard
      title="Invoices"
      contextLabel="Client portal invoices"
      tableId={OPERATIONAL_TABLE_IDS.portalClientInvoices}
      columns={CLIENT_INVOICES_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CLIENT_INVOICES_FILTER_ACCESSORS}
      rowKey={(row) => row.id}
      emptyMessage="No invoices."
    />
  );
}
