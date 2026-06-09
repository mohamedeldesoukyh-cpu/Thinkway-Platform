"use client";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { PORTAL_CLIENT_IO_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientApprovalForm } from "@/features/portals/components/client-approval-form";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { formatPortalDateTime } from "@/features/portals/components/portal-table-utils";
import type { ClientIoRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

const CLIENT_IO_COLUMNS: OperationalConfigurableColumnDef<ClientIoRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => row.campaign?.name ?? "—",
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => <PortalStatusBadge value={row.status} />,
  },
  {
    id: "sent",
    label: "Sent",
    renderCell: (row) => formatPortalDateTime(row.sent_at),
  },
  {
    id: "approved",
    label: "Approved",
    renderCell: (row) => formatPortalDateTime(row.approved_at),
  },
  {
    id: "action",
    label: "Action",
    headerClassName: "text-right",
    cellClassName: "text-right",
    renderCell: (row) =>
      row.status === "sent" ? (
        <ClientApprovalForm entityType="client_io" entityId={row.id} />
      ) : (
        "—"
      ),
  },
];

export const CLIENT_IO_COLUMN_METAS = getOperationalTableColumnMetas(CLIENT_IO_COLUMNS);

export function ClientIoTable({ rows }: { rows: ClientIoRow[] }) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.portalClientIo}
      columns={CLIENT_IO_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CLIENT_IO_FILTER_ACCESSORS}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Client IO</CardTitle>
          <OperationalTableControlsSlot contextLabel="Client portal IO" />
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client IO records.</p>
          ) : (
            <OperationalConfigurableTable
              columns={CLIENT_IO_COLUMNS}
              rows={rows}
              rowKey={(row) => row.id}
            />
          )}
        </CardContent>
      </Card>
    </OperationalTableSuiteProvider>
  );
}
