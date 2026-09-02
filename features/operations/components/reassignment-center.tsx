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
import { FinanceSuiteEmpty, FinanceSuiteKpiStrip } from "@/components/finance/suite";
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
  const campaignsMoved = batches.reduce((sum, batch) => sum + batch.campaign_count, 0);

  return (
    <div className="space-y-4">
      <FinanceSuiteKpiStrip
        items={[
          {
            id: "batches",
            label: "Movement batches",
            value: String(batches.length),
            hint: batches.length === 0 ? "nothing moved yet" : undefined,
          },
          {
            id: "campaigns",
            label: "Campaigns moved",
            value: String(campaignsMoved),
          },
          {
            id: "reversals",
            label: "Reversals",
            value: String(batches.filter((b) => b.status === "cancelled" || b.status === "failed").length),
            hint: "movements are reversed, not deleted",
          },
          {
            id: "audit",
            label: "Audit coverage",
            value: "Full",
            hint: "every move is recorded",
            tone: "ok",
          },
        ]}
      />
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
          <FinanceSuiteEmpty
            title="No movement batches yet"
            body="Campaigns have not been reassigned between groups, clients or brands. When they are, each batch lands here with its scope, totals and who executed it — permanently."
          />
        ) : (
          <OperationalConfigurableTable
            columns={REASSIGNMENT_BATCH_COLUMNS}
            rows={batches}
            rowKey={(batch) => batch.id}
          />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
    </div>
  );
}
