"use client";

import type { ReactNode } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { PORTAL_CREATOR_DELIVERABLES_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentNumber } from "@/components/ui/document-number";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { formatPortalDate } from "@/features/portals/components/portal-table-utils";
import type { CreatorDeliverableRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

const CREATOR_DELIVERABLES_COLUMNS: OperationalConfigurableColumnDef<CreatorDeliverableRow>[] = [
  {
    id: "deliverable",
    label: "Deliverable",
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.title}</p>
        <p className="text-xs text-muted-foreground">
          <DocumentNumber value={row.document_number} />
        </p>
      </div>
    ),
  },
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => row.campaign_name,
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => <PortalStatusBadge value={row.status} />,
  },
  {
    id: "due",
    label: "Due",
    renderCell: (row) => formatPortalDate(row.due_date),
  },
  {
    id: "content",
    label: "Content",
    cellClassName: "max-w-[200px] truncate text-xs",
    renderCell: (row) => row.content_url ?? "—",
  },
];

export const CREATOR_DELIVERABLES_COLUMN_METAS = getOperationalTableColumnMetas(
  CREATOR_DELIVERABLES_COLUMNS
);

export function CreatorDeliverablesTable({
  rows,
  panels,
}: {
  rows: CreatorDeliverableRow[];
  panels?: ReactNode;
}) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.portalCreatorDeliverables}
      columns={CREATOR_DELIVERABLES_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CREATOR_DELIVERABLES_FILTER_ACCESSORS}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Deliverables</CardTitle>
          <OperationalTableControlsSlot contextLabel="Creator portal deliverables" />
        </CardHeader>
        <CardContent className="space-y-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverables assigned.</p>
          ) : (
            <>
              <OperationalConfigurableTable
                columns={CREATOR_DELIVERABLES_COLUMNS}
                rows={rows}
                rowKey={(row) => row.id}
              />
              {panels}
            </>
          )}
        </CardContent>
      </Card>
    </OperationalTableSuiteProvider>
  );
}
