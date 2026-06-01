"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { createAssignmentDeliverableAction } from "@/features/campaigns/actions/assignment-deliverable-actions";
import { EditableDeliverableRow } from "@/features/campaigns/components/assignment-hierarchy/editable-deliverable-row";
import { CHILD_COLUMN_LABELS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

type AssignmentDeliverableRowsProps = {
  campaignId: string;
  line: CampaignLineWorkspace;
  deliverables: AssignmentDeliverableHierarchyRow[];
  currency: string;
  selectedIds: Set<string>;
  onToggleDeliverable: (id: string) => void;
  showSelection: boolean;
  parentColSpan: number;
};

export const AssignmentDeliverableRows = memo(function AssignmentDeliverableRows({
  campaignId,
  line,
  deliverables,
  currency,
  selectedIds,
  onToggleDeliverable,
  showSelection,
  parentColSpan,
}: AssignmentDeliverableRowsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const locked = line.vendor_assignment_locked ?? false;

  function addDeliverable() {
    startTransition(async () => {
      const result = await createAssignmentDeliverableAction({
        campaign_id: campaignId,
        campaign_line_id: line.id,
        platform: "instagram",
        deliverable_type: "instagram_reel",
        quantity: 1,
        unit_cost: 0,
        unit_revenue: 0,
        revenue_vat_percent: line.revenue_vat_percent,
        cost_vat_percent: line.cost_vat_percent,
      });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={parentColSpan} className="p-0">
        <div
          className={cn(
            "border-l-[3px] border-l-primary/40 bg-muted/30",
            "mx-2 mb-2 mt-0 rounded-lg border border-border/50 shadow-inner"
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Deliverables · {line.influencer_name ?? line.name}
            </p>
            {!locked ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addDeliverable}
                disabled={pending}
                title="Add deliverable (Alt+N)"
              >
                <PlusIcon data-icon="inline-start" className="size-3" />
                Add deliverable
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto px-2 pb-2">
            <table className="w-full min-w-[1100px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 px-2 py-1.5">{CHILD_COLUMN_LABELS.select}</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.tag}</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.platform}</th>
                  <th className="px-2 py-1.5">Type</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.postingDate}</th>
                  <th className="px-2 py-1.5 text-right">{CHILD_COLUMN_LABELS.qty}</th>
                  <th className="px-2 py-1.5 text-right">{CHILD_COLUMN_LABELS.unitRevenue}</th>
                  <th className="px-2 py-1.5 text-right">{CHILD_COLUMN_LABELS.unitCost}</th>
                  <th className="px-2 py-1.5 text-right">{CHILD_COLUMN_LABELS.revenue}</th>
                  <th className="px-2 py-1.5 text-right">{CHILD_COLUMN_LABELS.cost}</th>
                  <th className="px-2 py-1.5 text-right">{CHILD_COLUMN_LABELS.vat}</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.billing}</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.invoice}</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.collection}</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.payout}</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.workflow}</th>
                  <th className="px-2 py-1.5">{CHILD_COLUMN_LABELS.notes}</th>
                  <th className="px-2 py-1.5 text-right">{CHILD_COLUMN_LABELS.actions}</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map((deliverable, index) => (
                  <EditableDeliverableRow
                    key={deliverable.id}
                    campaignId={campaignId}
                    campaignLineId={line.id}
                    deliverable={deliverable}
                    currency={currency}
                    selected={selectedIds.has(deliverable.id)}
                    onToggleSelect={() => onToggleDeliverable(deliverable.id)}
                    showSelection={showSelection}
                    defaultRevenueVatPercent={line.revenue_vat_percent}
                    defaultCostVatPercent={line.cost_vat_percent}
                    revenueVatExempt={line.revenue_vat_exempt}
                    costVatExempt={line.cost_vat_exempt}
                    onRequestAddSibling={addDeliverable}
                    registerAddShortcut={index === 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
});
