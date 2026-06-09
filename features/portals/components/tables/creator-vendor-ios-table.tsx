"use client";

import {
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { PortalOperationalTableCard } from "@/features/portals/components/portal-operational-table-card";
import { CreatorApproveVendorIoForm } from "@/features/portals/components/creator-approve-vendor-io-form";
import { CreatorRejectVendorIoForm } from "@/features/portals/components/creator-reject-vendor-io-form";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import {
  formatPortalCurrency,
  formatPortalDateTime,
} from "@/features/portals/components/portal-table-utils";
import type { CreatorVendorIoRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { PORTAL_CREATOR_VENDOR_IOS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const CREATOR_VENDOR_IOS_COLUMNS: OperationalConfigurableColumnDef<CreatorVendorIoRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => row.campaign_name,
  },
  {
    id: "amount",
    label: "Amount",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.amount, row.currency_code),
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
        <div className="flex flex-col items-end gap-2">
          <CreatorApproveVendorIoForm vendorIoId={row.id} />
          <CreatorRejectVendorIoForm vendorIoId={row.id} />
        </div>
      ) : (
        "—"
      ),
  },
];

export const CREATOR_VENDOR_IOS_COLUMN_METAS = getOperationalTableColumnMetas(
  CREATOR_VENDOR_IOS_COLUMNS
);

export function CreatorVendorIosTable({ rows }: { rows: CreatorVendorIoRow[] }) {
  return (
    <PortalOperationalTableCard
      title="Vendor IOs"
      contextLabel="Creator portal vendor IOs"
      tableId={OPERATIONAL_TABLE_IDS.portalCreatorVendorIos}
      columns={CREATOR_VENDOR_IOS_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CREATOR_VENDOR_IOS_FILTER_ACCESSORS}
      rowKey={(row) => row.id}
      emptyMessage="No vendor IO records."
    />
  );
}
