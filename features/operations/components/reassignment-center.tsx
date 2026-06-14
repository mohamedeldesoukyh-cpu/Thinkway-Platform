"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { formatBillingMoney } from "@/features/billing/utils";
import type { MovementBatchRow } from "@/features/operations/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { REASSIGNMENT_BATCH_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  completed: "default",
  failed: "destructive",
  executing: "secondary",
  draft: "outline",
  preview: "outline",
  cancelled: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  brand_to_brand: "Brand → Brand",
  client_to_client: "Client → Client",
  group_to_group: "Group → Group",
};

const REASSIGNMENT_BATCH_COLUMNS: OperationalConfigurableColumnDef<MovementBatchRow>[] = [
  {
    id: "batch_number",
    label: "Batch #",
    monoCell: true,
    renderCell: (batch) => <DocumentNumber value={batch.document_number} />,
  },
  {
    id: "type",
    label: "Type",
    renderCell: (batch) => TYPE_LABELS[batch.movement_type] ?? batch.movement_type,
  },
  {
    id: "status",
    label: "Status",
    renderCell: (batch) => (
      <Badge variant={STATUS_VARIANT[batch.status] ?? "outline"}>{batch.status}</Badge>
    ),
  },
  {
    id: "campaigns",
    label: "Campaigns",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (batch) => batch.campaign_count,
  },
  {
    id: "revenue",
    label: "Revenue",
    headerClassName: "text-right",
    amountCell: true,
    amountVariant: "revenue",
    renderCell: (batch) => formatBillingMoney(batch.total_revenue),
  },
  {
    id: "gp",
    label: "GP",
    headerClassName: "text-right",
    amountCell: true,
    amountVariant: "gp",
    amountValue: (batch) => batch.total_gp,
    renderCell: (batch) => formatBillingMoney(batch.total_gp),
  },
  {
    id: "invoices",
    label: "Invoices",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (batch) => batch.total_invoices,
  },
  {
    id: "moved_by",
    label: "Moved by",
    renderCell: (batch) => batch.created_by_name ?? "—",
  },
  {
    id: "executed",
    label: "Executed",
    renderCell: (batch) =>
      batch.executed_at
        ? format(new Date(batch.executed_at), "MMM d, yyyy HH:mm")
        : "—",
  },
  {
    id: "reason",
    label: "Reason",
    cellClassName: "max-w-[200px] truncate",
    renderCell: (batch) => batch.reason,
  },
];

const REASSIGNMENT_BATCH_COLUMN_METAS = getOperationalTableColumnMetas(REASSIGNMENT_BATCH_COLUMNS);

type ReassignmentCenterProps = {
  batches: MovementBatchRow[];
};

export function ReassignmentCenter({ batches }: ReassignmentCenterProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.operationsReassignmentBatches}
      columns={REASSIGNMENT_BATCH_COLUMNS}
      rows={batches}
      filterAccessors={REASSIGNMENT_BATCH_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Reassignment history"
            description="Audit trail for campaign movements — batch numbers, totals, and execution status."
            actions={<OperationalTableControlsSlot contextLabel="Reassignment batches" />}
          />
        }
      >
        {batches.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">No movement batches yet.</p>
        ) : (
          <OperationalConfigurableTable
            columns={REASSIGNMENT_BATCH_COLUMNS}
            rows={batches}
            rowKey={(batch) => batch.id}
          />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
