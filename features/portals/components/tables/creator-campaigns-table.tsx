"use client";

import Link from "next/link";

import {
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { PortalOperationalTableCard } from "@/features/portals/components/portal-operational-table-card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { formatPortalCurrency } from "@/features/portals/components/portal-table-utils";
import type { CreatorCampaignRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { PORTAL_CREATOR_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const CREATOR_CAMPAIGNS_COLUMNS: OperationalConfigurableColumnDef<CreatorCampaignRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => (
      <div>
        <Link
          href={`/creator-portal/campaigns/${row.campaign_header_id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.campaign_name}
        </Link>
        <p className="text-xs text-muted-foreground">
          <DocumentNumber value={row.campaign_document_number} />
        </p>
      </div>
    ),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => <PortalStatusBadge value={row.assignment_status} />,
  },
  {
    id: "deliverables",
    label: "Deliverables",
    renderCell: (row) => `${row.pending_deliverables}/${row.deliverable_total} pending`,
  },
  {
    id: "publications",
    label: "Publications",
    renderCell: (row) => (
      <PortalStatusBadge value={row.recent_publication_status ?? "pending"} />
    ),
  },
  {
    id: "payment",
    label: "Payment",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.agreed_amount, row.currency_code),
  },
  {
    id: "vendor_io",
    label: "Vendor IO",
    renderCell: (row) => (
      <div className="flex items-center gap-2">
        <PortalStatusBadge value={row.vendor_io_status ?? "draft"} />
        <Link
          href="/creator-portal/vendor-ios"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open
        </Link>
      </div>
    ),
  },
];

export const CREATOR_CAMPAIGNS_COLUMN_METAS = getOperationalTableColumnMetas(CREATOR_CAMPAIGNS_COLUMNS);

export function CreatorCampaignsTable({ rows }: { rows: CreatorCampaignRow[] }) {
  return (
    <PortalOperationalTableCard
      title="Campaigns"
      contextLabel="Creator portal campaigns"
      tableId={OPERATIONAL_TABLE_IDS.portalCreatorCampaigns}
      columns={CREATOR_CAMPAIGNS_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CREATOR_CAMPAIGNS_FILTER_ACCESSORS}
      rowKey={(row) => row.assignment_id}
      emptyMessage="No assigned campaigns."
    />
  );
}
