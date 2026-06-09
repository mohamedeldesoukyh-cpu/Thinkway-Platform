"use client";

import {
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { ClientApprovalForm } from "@/features/portals/components/client-approval-form";
import { PortalOperationalTableCard } from "@/features/portals/components/portal-operational-table-card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import type { ClientApprovalRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { PORTAL_CLIENT_APPROVALS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const CLIENT_APPROVALS_COLUMNS: OperationalConfigurableColumnDef<ClientApprovalRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => row.campaign_name,
  },
  {
    id: "entity",
    label: "Entity",
    renderCell: (row) => row.entity_type,
  },
  {
    id: "title",
    label: "Title",
    renderCell: (row) => row.title,
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => <PortalStatusBadge value={row.status} />,
  },
  {
    id: "decision",
    label: "Decision",
    headerClassName: "text-right",
    cellClassName: "text-right",
    renderCell: (row) =>
      row.status === "Pending" ? (
        <ClientApprovalForm entityType={row.entity_type} entityId={row.entity_id} />
      ) : (
        "—"
      ),
  },
];

export const CLIENT_APPROVALS_COLUMN_METAS = getOperationalTableColumnMetas(CLIENT_APPROVALS_COLUMNS);

export function ClientApprovalsTable({ rows }: { rows: ClientApprovalRow[] }) {
  return (
    <PortalOperationalTableCard
      title="Approvals"
      contextLabel="Client portal approvals"
      tableId={OPERATIONAL_TABLE_IDS.portalClientApprovals}
      columns={CLIENT_APPROVALS_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CLIENT_APPROVALS_FILTER_ACCESSORS}
      rowKey={(row) => row.id}
      emptyMessage="No approvals pending."
    />
  );
}
