"use client";

import {
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { formatPortalDateTime } from "@/features/portals/components/portal-table-utils";
import type { CreatorPublicationRow } from "@/features/portals/types";

export function buildPortalPublicationsColumns(): OperationalConfigurableColumnDef<CreatorPublicationRow>[] {
  return [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (row) => row.campaign_name,
    },
    {
      id: "platform",
      label: "Platform",
      renderCell: (row) => row.platform,
    },
    {
      id: "type",
      label: "Type",
      renderCell: (row) => row.publication_type,
    },
    {
      id: "status",
      label: "Status",
      renderCell: (row) => <PortalStatusBadge value={row.status} />,
    },
    {
      id: "date",
      label: "Date",
      renderCell: (row) => formatPortalDateTime(row.publication_date),
    },
  ];
}

export function getPortalPublicationsColumnMetas() {
  return getOperationalTableColumnMetas(buildPortalPublicationsColumns());
}
