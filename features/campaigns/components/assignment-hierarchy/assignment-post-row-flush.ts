import {
  updateAssignmentDeliverableAction,
  updatePostScheduleAction,
} from "@/features/campaigns/actions/assignment-deliverable-actions";
import type { AssignmentGridFlushResult } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-edit-session";
import type { AssignmentPostMetaDraft } from "@/features/campaigns/components/assignment-hierarchy/assignment-post-draft-dirty";
import type { OperationalCommercialDraft } from "@/features/campaigns/components/assignment-hierarchy/use-operational-commercial-draft";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentPostOperationalRow,
} from "@/features/campaigns/types/assignment-hierarchy";

export async function persistAssignmentPostRowDraft(args: {
  campaignId: string;
  campaignLineId: string;
  deliverable: AssignmentDeliverableHierarchyRow;
  post: AssignmentPostOperationalRow;
  deliverableScoped: boolean;
  isVirtualPost: boolean;
  includeCommercial: boolean;
  commercial: OperationalCommercialDraft;
  meta: AssignmentPostMetaDraft;
}): Promise<AssignmentGridFlushResult> {
  const {
    campaignId,
    campaignLineId,
    deliverable,
    post,
    deliverableScoped,
    isVirtualPost,
    includeCommercial,
    commercial,
    meta,
  } = args;
  const postId = typeof post.id === "string" ? post.id : "";

  if (deliverableScoped && includeCommercial) {
    const commercialResult = await updateAssignmentDeliverableAction({
      campaign_id: campaignId,
      campaign_line_id: campaignLineId,
      deliverable_id: deliverable.id,
      platform: meta.platform,
      deliverable_type: meta.deliverable_type,
      quantity: commercial.qty,
      unit_revenue: commercial.revPerAd,
      unit_cost: commercial.costPerAd,
      usage_rights_amount: Number(deliverable.usage_rights_amount ?? 0),
      usage_rights_cost: Number(deliverable.usage_rights_cost ?? 0),
      agency_fee_percent: Number(deliverable.agency_fee_percent ?? 0),
      revenue_vat_percent: meta.revenue_vat_percent,
      live_date: meta.live_date || null,
      notes: meta.notes || null,
      billing_status: meta.billing_status as typeof post.billing_status,
    });
    if (!commercialResult.ok) {
      return { ok: false, message: commercialResult.message ?? "Failed to save." };
    }
    if (!isVirtualPost && postId) {
      const statusResult = await updatePostScheduleAction({
        campaign_id: campaignId,
        schedule_id: postId,
        live_date: meta.live_date || null,
        status: meta.workflow_status,
        revenue_per_post: commercial.revPerAd,
        cost_per_post: commercial.costPerAd,
        revenue_vat_percent: meta.revenue_vat_percent,
        notes: meta.notes || null,
        billing_status: meta.billing_status as typeof post.billing_status,
        platform: meta.platform,
        deliverable_type: meta.deliverable_type,
      });
      if (!statusResult.ok) {
        return {
          ok: false,
          message: statusResult.message ?? "Failed to save workflow status.",
        };
      }
    }
    return { ok: true };
  }

  if (!postId || isVirtualPost) {
    return { ok: true };
  }

  const result = await updatePostScheduleAction({
    campaign_id: campaignId,
    schedule_id: postId,
    live_date: meta.live_date || null,
    status: meta.workflow_status,
    revenue_per_post: commercial.revPerAd,
    cost_per_post: commercial.costPerAd,
    revenue_vat_percent: meta.revenue_vat_percent,
    notes: meta.notes || null,
    billing_status: meta.billing_status as typeof post.billing_status,
    platform: meta.platform,
    deliverable_type: meta.deliverable_type,
  });
  if (!result.ok) {
    return { ok: false, message: result.message ?? "Failed to save." };
  }
  return { ok: true };
}
