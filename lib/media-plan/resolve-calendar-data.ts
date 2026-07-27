import type { CampaignObject } from "@/features/campaign-intelligence";
import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";
import { generateMediaPlan } from "@/features/campaign-outputs/generators/media-plan";
import { getMediaPlanLifecycle } from "@/features/campaign-outputs/media-plan-mutations";
import { getOutputContentForDisplay } from "@/features/campaign-outputs/output-registry";
import { emptyMediaPlanData } from "@/lib/media-plan/calendar-adapter";

export function resolveOriginalData(campaignObject: CampaignObject): MediaPlanData {
  const content = getOutputContentForDisplay(campaignObject, "media_plan");
  if (content?.data) {
    return content.data as unknown as MediaPlanData;
  }
  try {
    const generated = generateMediaPlan(campaignObject);
    if (generated.data) {
      return generated.data as unknown as MediaPlanData;
    }
  } catch {
    /* fall through */
  }
  return emptyMediaPlanData(new Date().toISOString().slice(0, 10), 4);
}

/**
 * Calendar data for the Current Approved Baseline — never the Working Draft tip.
 * Used as the item source for Actual / Remaining Engine projections and Client Portal Original.
 */
export function resolveApprovedBaselineData(
  campaignObject: CampaignObject,
  tipData: MediaPlanData
): MediaPlanData {
  const lifecycle = getMediaPlanLifecycle(campaignObject);
  if (lifecycle.currentApprovedBaselineVersion == null) {
    return tipData;
  }
  // Tip equals baseline when there is no active draft.
  if (lifecycle.workingDraftVersion == null) {
    return tipData;
  }
  const snap =
    lifecycle.approvedScheduleSnapshots[
      String(lifecycle.currentApprovedBaselineVersion)
    ];
  if (!snap || typeof snap !== "object") {
    return tipData;
  }
  const baselineObject: CampaignObject = {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      mediaPlanSchedule: snap as CampaignObject["meta"]["mediaPlanSchedule"],
    },
  };
  try {
    const generated = generateMediaPlan(baselineObject);
    if (generated.data) {
      return generated.data as unknown as MediaPlanData;
    }
  } catch {
    /* fall through */
  }
  return tipData;
}
