"use client";

import {
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { PortalOperationalTableCard } from "@/features/portals/components/portal-operational-table-card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { formatPortalCurrency } from "@/features/portals/components/portal-table-utils";
import type { CreatorPaymentRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { PORTAL_CREATOR_PAYMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const CREATOR_PAYMENTS_COLUMNS: OperationalConfigurableColumnDef<CreatorPaymentRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => row.campaign_name,
  },
  {
    id: "agreed_amount",
    label: "Agreed amount",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.agreed_amount, row.currency_code),
  },
  {
    id: "invoiced",
    label: "Invoiced",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.invoiced_amount, row.currency_code),
  },
  {
    id: "paid",
    label: "Paid",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.paid_amount, row.currency_code),
  },
  {
    id: "pending",
    label: "Pending",
    amountCell: true,
    renderCell: (row) => formatPortalCurrency(row.pending_amount, row.currency_code),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => <PortalStatusBadge value={row.payment_status} />,
  },
];

export const CREATOR_PAYMENTS_COLUMN_METAS = getOperationalTableColumnMetas(CREATOR_PAYMENTS_COLUMNS);

export function CreatorPaymentsTable({ rows }: { rows: CreatorPaymentRow[] }) {
  return (
    <PortalOperationalTableCard
      title="Payments"
      contextLabel="Creator portal payments"
      tableId={OPERATIONAL_TABLE_IDS.portalCreatorPayments}
      columns={CREATOR_PAYMENTS_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CREATOR_PAYMENTS_FILTER_ACCESSORS}
      rowKey={(row) => row.assignment_id}
      emptyMessage="No payment records yet."
    />
  );
}
