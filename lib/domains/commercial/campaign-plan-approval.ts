import type { CampaignObjectLifecycleStatus } from "@/types/database";
import type { PresentationStatusSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { canGenerateFromCampaignPlan } from "./campaign-plan-provenance";
import type { CampaignPlanReadiness } from "./campaign-plan-readiness";

export const APPROVED_PLAN_EDIT_BLOCKED_MESSAGE =
  "Request changes to edit an approved Campaign Plan.";

/** Map DB lifecycle to the presentation section status shown in Studio. */
export function mapLifecycleToPresentationStatus(
  lifecycleStatus: CampaignObjectLifecycleStatus | string | null | undefined
): PresentationStatusSectionData["status"] {
  switch (lifecycleStatus) {
    case "approved":
    case "published":
      return "approved";
    case "in_review":
      return "awaiting_approval";
    case "draft":
    default:
      return "draft";
  }
}

/** Whether the plan may be submitted for Campaign Director review. */
export function canSubmitCampaignPlanForReview(
  lifecycleStatus: CampaignObjectLifecycleStatus | string | null | undefined,
  readiness: Pick<CampaignPlanReadiness, "status">
): boolean {
  return lifecycleStatus === "draft" && readiness.status === "ready_for_review";
}

/** Whether a director may approve a plan currently in review. */
export function canApproveCampaignPlan(
  lifecycleStatus: CampaignObjectLifecycleStatus | string | null | undefined
): boolean {
  return lifecycleStatus === "in_review";
}

/** Whether a director may send a plan back for edits. */
export function canRequestCampaignPlanChanges(
  lifecycleStatus: CampaignObjectLifecycleStatus | string | null | undefined
): boolean {
  return (
    lifecycleStatus === "in_review" ||
    lifecycleStatus === "approved" ||
    lifecycleStatus === "published"
  );
}

/** Approved/published plans are frozen until changes are requested. */
export function isCampaignPlanLockedForEdits(
  lifecycleStatus: CampaignObjectLifecycleStatus | string | null | undefined
): boolean {
  return lifecycleStatus === "approved" || lifecycleStatus === "published";
}

export type CampaignPlanApprovalFlags = {
  canSubmitForReview: boolean;
  canApprove: boolean;
  canRequestChanges: boolean;
  canGenerate: boolean;
};

export function deriveCampaignPlanApprovalFlags(input: {
  lifecycleStatus: CampaignObjectLifecycleStatus | string | null | undefined;
  readiness: Pick<CampaignPlanReadiness, "status">;
}): CampaignPlanApprovalFlags {
  return {
    canSubmitForReview: canSubmitCampaignPlanForReview(
      input.lifecycleStatus,
      input.readiness
    ),
    canApprove: canApproveCampaignPlan(input.lifecycleStatus),
    canRequestChanges: canRequestCampaignPlanChanges(input.lifecycleStatus),
    canGenerate: canGenerateFromCampaignPlan(input.lifecycleStatus),
  };
}
