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
import { getCreatorConnectedPlatformOptions, getDeliverableTypeCodesForPlatform } from "@/lib/campaigns/deliverable-taxonomy";
import { effectiveLineOperationalStatusForUi } from "@/lib/campaigns/effective-operational-status";
import {
  OPERATIONAL_TABLE_HEADER_SURFACE,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
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
  const parentOperationalStatus = effectiveLineOperationalStatusForUi({
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    billing_status: line.billing_status,
    invoice_id: line.invoice_id,
  });
  const platformOptions = getCreatorConnectedPlatformOptions({
    creatorPlatformAccounts: line.creator_platform_accounts,
    assignment: line.assignment,
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("Creator platforms", line.creator_platform_accounts);
    console.log("Assignment platforms", line.assignment?.platforms);
    console.log("Available platform options", platformOptions);
  }, [line.creator_platform_accounts, line.assignment, platformOptions]);

  function addDeliverable() {
    const defaultPlatform = platformOptions[0]?.value ?? "instagram";
    const defaultTypes = getDeliverableTypeCodesForPlatform(defaultPlatform);
    startTransition(async () => {
      const result = await createAssignmentDeliverableAction({
        campaign_id: campaignId,
        campaign_line_id: line.id,
        platform: defaultPlatform,
        deliverable_type: defaultTypes[0] ?? "other",
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
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell colSpan={parentColSpan} className="p-0">
        <div className={cn("mt-0 pl-2", OPERATIONAL_TABLE_SURFACE)}>
          <div className="overflow-x-auto pb-0.5">
            <table
              className={cn(
                "w-full min-w-[1100px] border-collapse text-[11px] font-normal",
                OPERATIONAL_TABLE_SURFACE
              )}
            >
              <thead
                className={cn(
                  "sticky top-0 z-[4] border-b border-border/50",
                  OPERATIONAL_TABLE_HEADER_SURFACE
                )}
              >
                <OperationalGridHeader
                  actions={
                    !locked ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] font-normal"
                        onClick={addDeliverable}
                        disabled={pending}
                        title="Add deliverable (Alt+N)"
                      >
                        <PlusIcon className="size-3" />
                        Add
                      </Button>
                    ) : null
                  }
                />
              </thead>
              <tbody>
                {deliverables.map((deliverable) => (
                  <DeliverableGroupRow
                    key={deliverable.id}
                    campaignId={campaignId}
                    campaignLineId={line.id}
                    deliverable={deliverable}
                    currency={currency}
                    parentOperationalStatus={parentOperationalStatus}
                    selected={selectedIds.has(deliverable.id)}
                    onToggleSelect={() => onToggleDeliverable(deliverable.id)}
                    showSelection={showSelection}
                    revenueVatExempt={line.revenue_vat_exempt}
                    defaultRevenueVatPercent={line.revenue_vat_percent}
                    platformOptions={platformOptions}
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
