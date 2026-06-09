"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { AlertTriangleIcon, ArchiveIcon, ArrowRightLeftIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getEntityDependenciesAction } from "@/features/operations/actions";
import { formatBillingMoney } from "@/features/billing/utils";
import type { EntityType, LinkedCampaignSummary } from "@/lib/operations/entity-dependencies";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { ENTITY_CAMPAIGN_DEPS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const ENTITY_CAMPAIGN_DEPS_COLUMNS: OperationalConfigurableColumnDef<LinkedCampaignSummary>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (campaign) => (
      <div>
        <span className="font-medium">{campaign.name}</span>
        <p className="text-xs text-muted-foreground">
          <DocumentNumber value={campaign.document_number} />
        </p>
      </div>
    ),
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize",
    renderCell: (campaign) => campaign.status,
  },
  {
    id: "revenue",
    label: "Revenue",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (campaign) => formatBillingMoney(campaign.revenue),
  },
  {
    id: "gp",
    label: "GP",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (campaign) => formatBillingMoney(campaign.gp),
  },
];

const ENTITY_CAMPAIGN_DEPS_COLUMN_METAS = getOperationalTableColumnMetas(
  ENTITY_CAMPAIGN_DEPS_COLUMNS
);

type EntityDependencyDialogProps = {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: () => void;
};

export function EntityDependencyDialog({
  entityType,
  entityId,
  entityName,
  open,
  onOpenChange,
  onArchive,
}: EntityDependencyDialogProps) {
  const [state, formAction, pending] = useActionState(getEntityDependenciesAction, {
    ok: false,
  });

  useEffect(() => {
    if (!open) return;
    const fd = new FormData();
    fd.set("entity_type", entityType);
    fd.set("entity_id", entityId);
    formAction(fd);
  }, [open, entityType, entityId, formAction]);

  const deps = state.dependencies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-500" />
            Cannot delete — linked activity
          </DialogTitle>
          <DialogDescription>
            {entityName} has historical transactions. Reassign or archive instead of permanent delete.
          </DialogDescription>
        </DialogHeader>

        {pending && !deps ? (
          <p className="text-sm text-muted-foreground">Checking dependencies…</p>
        ) : deps ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Campaigns", deps.campaigns],
                ["Invoices", deps.invoices],
                ["Collections", deps.collections],
                ["Approvals", deps.approvals],
                ["Billing lines", deps.billing_lines],
                ["Audit records", deps.audit_records],
              ].map(([label, count]) => (
                <div key={label as string} className="rounded-2xl border p-3">
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <p className="text-xl font-semibold">{count as number}</p>
                </div>
              ))}
            </div>

            {deps.linked_campaigns.length > 0 ? (
              <OperationalTableSuiteProvider
                tableId={OPERATIONAL_TABLE_IDS.dialogEntityCampaignDeps}
                columns={ENTITY_CAMPAIGN_DEPS_COLUMNS}
                rows={deps.linked_campaigns}
                filterAccessors={ENTITY_CAMPAIGN_DEPS_FILTER_ACCESSORS}
              >
                <div className="flex justify-end pb-2">
                  <OperationalTableControlsSlot contextLabel="Linked campaigns" />
                </div>
                <OperationalConfigurableTable
                  columns={ENTITY_CAMPAIGN_DEPS_COLUMNS}
                  rows={deps.linked_campaigns}
                  rowKey={(campaign) => campaign.id}
                />
              </OperationalTableSuiteProvider>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" asChild>
            <Link href="/operations/move">
              <ArrowRightLeftIcon className="size-4" />
              Move transactions
            </Link>
          </Button>
          {onArchive ? (
            <Button variant="secondary" onClick={onArchive}>
              <ArchiveIcon className="size-4" />
              Archive entity
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
