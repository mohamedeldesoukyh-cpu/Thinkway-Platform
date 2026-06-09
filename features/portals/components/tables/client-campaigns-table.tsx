"use client";

import {
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { PortalOperationalTableCard } from "@/features/portals/components/portal-operational-table-card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import type { ClientCampaignRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { PORTAL_CLIENT_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const CLIENT_CAMPAIGNS_COLUMNS: OperationalConfigurableColumnDef<ClientCampaignRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.campaign_name}</p>
        <p className="text-xs text-muted-foreground">
          <DocumentNumber value={row.campaign_document_number} />
        </p>
      </div>
    ),
  },
  {
    id: "progress",
    label: "Progress",
    renderCell: (row) => <PortalStatusBadge value={row.status} />,
  },
  {
    id: "deliverables",
    label: "Deliverables",
    renderCell: (row) => row.deliverable_total,
  },
  {
    id: "publications",
    label: "Publications",
    renderCell: (row) => row.publication_total,
  },
  {
    id: "approvals",
    label: "Approvals",
    renderCell: (row) => `${row.pending_approvals} pending`,
  },
  {
    id: "client_io",
    label: "Client IO",
    renderCell: (row) => <PortalStatusBadge value={row.client_io_status ?? "draft"} />,
  },
];

export const CLIENT_CAMPAIGNS_COLUMN_METAS = getOperationalTableColumnMetas(CLIENT_CAMPAIGNS_COLUMNS);

export function ClientCampaignsTable({ rows }: { rows: ClientCampaignRow[] }) {
  return (
    <PortalOperationalTableCard
      title="Campaigns"
      contextLabel="Client portal campaigns"
      tableId={OPERATIONAL_TABLE_IDS.portalClientCampaigns}
      columns={CLIENT_CAMPAIGNS_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CLIENT_CAMPAIGNS_FILTER_ACCESSORS}
      rowKey={(row) => row.campaign_header_id}
      emptyMessage="No campaigns."
    />
  );
}
