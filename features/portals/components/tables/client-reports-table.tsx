"use client";

import {
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { PortalOperationalTableCard } from "@/features/portals/components/portal-operational-table-card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import type { ClientReportRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { PORTAL_CLIENT_REPORTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const CLIENT_REPORTS_COLUMNS: OperationalConfigurableColumnDef<ClientReportRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => row.campaign_name,
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => <PortalStatusBadge value={row.campaign_status} />,
  },
  {
    id: "publications",
    label: "Publications",
    renderCell: (row) => row.total_publications,
  },
  {
    id: "approved_publications",
    label: "Approved publications",
    renderCell: (row) => row.approved_publications,
  },
  {
    id: "deliverables",
    label: "Deliverables",
    renderCell: (row) => row.total_deliverables,
  },
  {
    id: "approved_deliverables",
    label: "Approved deliverables",
    renderCell: (row) => row.approved_deliverables,
  },
];

export const CLIENT_REPORTS_COLUMN_METAS = getOperationalTableColumnMetas(CLIENT_REPORTS_COLUMNS);

export function ClientReportsTable({ rows }: { rows: ClientReportRow[] }) {
  return (
    <PortalOperationalTableCard
      title="Reports"
      contextLabel="Client portal reports"
      tableId={OPERATIONAL_TABLE_IDS.portalClientReports}
      columns={CLIENT_REPORTS_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CLIENT_REPORTS_FILTER_ACCESSORS}
      rowKey={(row) => row.campaign_header_id}
      emptyMessage="No report data yet."
    />
  );
}
