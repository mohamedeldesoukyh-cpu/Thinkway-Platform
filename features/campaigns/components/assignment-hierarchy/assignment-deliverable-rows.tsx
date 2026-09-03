"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createAssignmentDeliverableAction } from "@/features/campaigns/actions/assignment-deliverable-actions";
import type { AssignmentGridColumnId } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-layout";
import { buildAssignmentCssGridCols } from "@/features/campaigns/components/assignment-hierarchy/assignment-css-grid";
import { DeliverableGroupRow } from "@/features/campaigns/components/assignment-hierarchy/deliverable-group-row";
import { assignmentChildLeadingParentColumnIds } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { OperationalGridHeader } from "@/features/campaigns/components/assignment-hierarchy/editable-post-row";
import { useAssignmentGridEditSession } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-edit-session";
import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { getCreatorConnectedPlatformOptions, getDeliverableTypeCodesForPlatform } from "@/lib/campaigns/deliverable-taxonomy";
import { effectiveLineOperationalStatusForUi } from "@/lib/campaigns/effective-operational-status";

type AssignmentDeliverableRowsProps = {
  campaignId: string;
  line: CampaignLineWorkspace;
  deliverables: AssignmentDeliverableHierarchyRow[];
  currency: string;
  selectedIds: Set<string>;
  onToggleDeliverable: (id: string) => void;
  showSelection: boolean;
  parentColSpan: number;
  nestedGroupClassName?: string;
  showExpandColumn?: boolean;
  leadingParentColumnIds?: readonly string[];
  fallbackLeadingWidths?: readonly number[];
  fallbackChildTableWidthPx?: number;
  gridCols?: string;
  parentTrackIds?: readonly AssignmentGridColumnId[];
};

export const AssignmentDeliverableRows = memo(function AssignmentDeliverableRows({
  campaignId,
  line,
  deliverables,
  currency,
  selectedIds,
  onToggleDeliverable,
  showSelection,
  showExpandColumn = false,
  leadingParentColumnIds: leadingParentColumnIdsProp,
  gridCols: gridColsProp,
  parentTrackIds: parentTrackIdsProp,
}: AssignmentDeliverableRowsProps) {
  const leadingParentColumnIds =
    leadingParentColumnIdsProp ?? assignmentChildLeadingParentColumnIds(showExpandColumn);
  const parentTrackIds =
    parentTrackIdsProp ?? (leadingParentColumnIds as AssignmentGridColumnId[]);
  const gridCols =
    gridColsProp ?? buildAssignmentCssGridCols(parentTrackIds);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const locked = line.vendor_assignment_locked ?? false;
  const parentOperationalStatus = effectiveLineOperationalStatusForUi({
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    billing_status: line.billing_status,
    invoice_id: line.invoice_id,
    revenue_locked: line.revenue_locked,
    vendor_assignment_locked: line.vendor_assignment_locked,
  });
  const platformOptions = getCreatorConnectedPlatformOptions({
    creatorPlatformAccounts: line.creator_platform_accounts,
    assignment: line.assignment,
  });
  const gridEdit = useAssignmentGridEditSession();

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
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      if (event.altKey && key === "n") {
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
    <>
      <OperationalGridHeader
        showExpandColumn={showExpandColumn}
        leadingParentColumnIds={leadingParentColumnIds}
        gridCols={gridCols}
        parentTrackIds={parentTrackIds}
        actions={
          !locked && !gridEdit.isEditing ? (
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
      {deliverables.map((deliverable, deliverableIndex) => (
        <DeliverableGroupRow
          key={deliverable.id}
          campaignId={campaignId}
          campaignLineId={line.id}
          line={line}
          deliverable={deliverable}
          currency={currency}
          parentOperationalStatus={parentOperationalStatus}
          selected={selectedIds.has(deliverable.id)}
          onToggleSelect={() => onToggleDeliverable(deliverable.id)}
          showSelection={showSelection}
          revenueVatExempt={line.revenue_vat_exempt}
          defaultRevenueVatPercent={line.revenue_vat_percent}
          platformOptions={platformOptions}
          showExpandColumn={showExpandColumn}
          leadingParentColumnIds={leadingParentColumnIds}
          isLastDeliverable={deliverableIndex === deliverables.length - 1}
          gridCols={gridCols}
          parentTrackIds={parentTrackIds}
        />
      ))}
    </>
  );
});
