import type { MediaPlanCampaignContext } from "../generators/media-plan";

/** Merge live-resolved context over cached media plan data for preview surfaces. */
export function mergeMediaPlanContext(
  cached: MediaPlanCampaignContext | undefined,
  override: MediaPlanCampaignContext | undefined
): MediaPlanCampaignContext | undefined {
  if (!cached && !override) return undefined;
  const merged: MediaPlanCampaignContext = {
    brandName: override?.brandName?.trim() || cached?.brandName,
    groupName: override?.groupName?.trim() || cached?.groupName,
    agencyName: override?.agencyName?.trim() || cached?.agencyName,
  };
  if (!merged.brandName && !merged.groupName && !merged.agencyName) return undefined;
  return merged;
}
