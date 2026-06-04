"use client";

import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { EditablePostRow } from "@/features/campaigns/components/assignment-hierarchy/editable-post-row";
import { effectiveLineOperationalStatusForUi } from "@/lib/campaigns/effective-operational-status";

type DeliverableGroupRowProps = {
  campaignId: string;
  campaignLineId: string;
  deliverable: AssignmentDeliverableHierarchyRow;
  currency: string;
  parentOperationalStatus: CampaignLineOperationalStatus;
  selected: boolean;
  onToggleSelect: () => void;
  showSelection: boolean;
  revenueVatExempt: boolean;
  defaultRevenueVatPercent: number;
  platformOptions: { value: string; label: string }[];
};

/** Renders operational post rows only — no intermediate deliverable totals row. */
export function DeliverableGroupRow({
  campaignId,
  campaignLineId,
  deliverable,
  currency,
  parentOperationalStatus,
  selected,
  onToggleSelect,
  showSelection,
  revenueVatExempt,
  defaultRevenueVatPercent,
  platformOptions,
}: DeliverableGroupRowProps) {
  const readOnly = deliverable.is_synthetic || deliverable.is_locked;
  const posts = Array.isArray(deliverable.posts) ? deliverable.posts : [];
  const deliverableScoped = posts.length === 1;
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
        />
      ))}
    </>
  );
}
