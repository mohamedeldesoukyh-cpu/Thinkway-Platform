"use client";

import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { EditablePostRow } from "@/features/campaigns/components/assignment-hierarchy/editable-post-row";
import { effectiveLineOperationalStatusForUi } from "@/lib/campaigns/effective-operational-status";
import {
  isFirstPostOfType,
  resolveAssignmentTypeCommercial,
  uniqueAssignmentPostTypeCount,
  type AssignmentTypeCommercialSlice,
} from "@/lib/campaigns/assignment-type-commercial";

type DeliverableGroupRowProps = {
  campaignId: string;
  campaignLineId: string;
  line?: CampaignLineWorkspace | null;
  deliverable: AssignmentDeliverableHierarchyRow;
  currency: string;
  parentOperationalStatus: CampaignLineOperationalStatus;
  selected: boolean;
  onToggleSelect: () => void;
  showSelection: boolean;
  revenueVatExempt: boolean;
  defaultRevenueVatPercent: number;
  platformOptions: { value: string; label: string }[];
  showExpandColumn?: boolean;
  leadingParentColumnIds?: readonly string[];
  isLastDeliverable?: boolean;
  gridCols?: string;
  parentTrackIds?: readonly string[];
};

/** Renders operational post rows only — no intermediate deliverable totals row. */
export function DeliverableGroupRow({
  campaignId,
  campaignLineId,
  line,
  deliverable,
  currency,
  parentOperationalStatus,
  selected,
  onToggleSelect,
  showSelection,
  revenueVatExempt,
  defaultRevenueVatPercent,
  platformOptions,
  showExpandColumn = false,
  leadingParentColumnIds,
  isLastDeliverable = false,
  gridCols,
  parentTrackIds,
}: DeliverableGroupRowProps) {
  const readOnly = deliverable.is_synthetic || deliverable.is_locked;
  const posts = Array.isArray(deliverable.posts) ? deliverable.posts : [];
  const deliverableScoped = posts.length === 1;
  const mixedTypes = uniqueAssignmentPostTypeCount(posts) > 1;
  const packageLine = (line?.assignment?.pricing_mode ?? "package") === "package";
  const lineSeed = line
    ? {
        revenueBeforeVat: Number(line.revenue_before_vat ?? line.revenue) || 0,
        costBeforeVat: Number(line.cost_before_vat ?? line.cost) || 0,
        usageRightsAmount: Number(line.usage_rights_amount ?? 0),
        usageRightsCost: Number(line.usage_rights_cost ?? 0),
        agencyFeePercent: Number(line.agency_fee_percent ?? 0),
      }
    : null;
  const typeCommercialByPostId = new Map<string, AssignmentTypeCommercialSlice>();
  for (const row of posts) {
    if (!row.id || !isFirstPostOfType(posts, String(row.id))) continue;
    typeCommercialByPostId.set(
      String(row.id),
      resolveAssignmentTypeCommercial({
        posts,
        post: row,
        deliverable,
        line: lineSeed,
      })
    );
  }
  const safeParentStatus = effectiveLineOperationalStatusForUi({
    operational_status: parentOperationalStatus,
    vendor_io_id: null,
  });

  return (
    <>
      {posts.map((post, index) => (
        <EditablePostRow
          key={post.id ?? `${deliverable.id}-post-${index}`}
          campaignId={campaignId}
          campaignLineId={campaignLineId}
          deliverable={deliverable}
          post={post}
          currency={currency}
          parentOperationalStatus={safeParentStatus}
          readOnly={readOnly}
          revenueVatExempt={revenueVatExempt}
          defaultRevenueVatPercent={defaultRevenueVatPercent}
          platformOptions={platformOptions}
          deliverableScoped={deliverableScoped}
          showSelection={showSelection && index === 0}
          selected={selected}
          onToggleSelect={onToggleSelect}
          isFirstPost={index === 0}
          isFirstOfType={isFirstPostOfType(posts, String(post.id))}
          mixedTypes={mixedTypes}
          packageLine={packageLine}
          typeCommercial={
            post.id ? typeCommercialByPostId.get(String(post.id)) ?? null : null
          }
          isLastChildRow={isLastDeliverable && index === posts.length - 1}
          showExpandColumn={showExpandColumn}
          leadingParentColumnIds={leadingParentColumnIds}
          gridCols={gridCols}
          parentTrackIds={parentTrackIds}
        />
      ))}
    </>
  );
}
