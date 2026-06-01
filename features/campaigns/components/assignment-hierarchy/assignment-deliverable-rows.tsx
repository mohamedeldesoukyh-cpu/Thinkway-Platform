"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { createAssignmentDeliverableAction } from "@/features/campaigns/actions/assignment-deliverable-actions";
import { DeliverableGroupRow } from "@/features/campaigns/components/assignment-hierarchy/deliverable-group-row";
import { OperationalGridHeader } from "@/features/campaigns/components/assignment-hierarchy/editable-post-row";
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
      if (result.ok) router.refresh();
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && event.key.toLowerCase() === "n") {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        if (!locked) addDeliverable();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, campaignId, line.id]);

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={parentColSpan} className="p-0">
        <div
          className={cn(
            "border-l-[3px] border-l-primary/40 bg-muted/25",
            "mx-1 mb-2 mt-0 rounded-lg border border-border/50"
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Operational deliverables · {line.influencer_name ?? line.name}
            </p>
            {!locked ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px]"
                onClick={addDeliverable}
                disabled={pending}
                title="Add deliverable (Alt+N)"
              >
                <PlusIcon data-icon="inline-start" className="size-3" />
                Add deliverable
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto px-1 pb-1.5">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <OperationalGridHeader />
              </thead>
              <tbody>
                {deliverables.map((deliverable) => (
                  <DeliverableGroupRow
                    key={deliverable.id}
                    campaignId={campaignId}
                    deliverable={deliverable}
                    currency={currency}
                    selected={selectedIds.has(deliverable.id)}
                    onToggleSelect={() => onToggleDeliverable(deliverable.id)}
                    showSelection={showSelection}
                    revenueVatExempt={line.revenue_vat_exempt}
                    defaultRevenueVatPercent={line.revenue_vat_percent}
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
