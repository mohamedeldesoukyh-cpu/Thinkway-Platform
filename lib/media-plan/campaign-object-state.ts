import type { CampaignObject } from "@/features/campaign-intelligence";
import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";

import { mediaPlanDataToItems } from "./calendar-adapter";
import { createDefaultMediaPlanLifecycle } from "./lifecycle-meta";
import type { MediaPlanItem, MediaPlanState, MediaPlanVersionRecord } from "./types";

function lifecycleOf(campaignObject: CampaignObject) {
  return (
    campaignObject.meta.mediaPlanLifecycle ??
    createDefaultMediaPlanLifecycle(campaignObject.updatedAt || new Date().toISOString())
  );
}

/**
 * Build an engine MediaPlanState from the Campaign Object lifecycle + calendars.
 *
 * @param baselineData — Current Approved Baseline calendar (for Actual/Remaining)
 * @param tipData — Working tip calendar (draft or baseline) for Original
 */
export function mediaPlanStateFromCampaignObject(
  campaignObject: CampaignObject,
  baselineData: MediaPlanData,
  options?: { campaignId?: string; tipData?: MediaPlanData }
): MediaPlanState {
  const lifecycle = lifecycleOf(campaignObject);
  const tipData = options?.tipData ?? baselineData;
  const baselineItems = mediaPlanDataToItems(baselineData);
  const tipItems = mediaPlanDataToItems(tipData);
  const at = campaignObject.updatedAt || new Date().toISOString();

  const versions: MediaPlanVersionRecord[] = [];

  if (lifecycle.currentApprovedBaselineVersion != null) {
    versions.push({
      version: lifecycle.currentApprovedBaselineVersion,
      kind: "baseline",
      status:
        lifecycle.status === "approved_on_behalf" ? "approved_on_behalf" : "approved_by_client",
      items: baselineItems,
      createdAt: at,
      approvedAt: lifecycle.lockedAt ?? at,
      label: `Approved v${lifecycle.currentApprovedBaselineVersion}`,
    });
  }

  if (lifecycle.workingDraftVersion != null) {
    versions.push({
      version: lifecycle.workingDraftVersion,
      kind: "draft",
      status: lifecycle.status === "locked" ? "locked" : "draft",
      items: tipItems,
      createdAt: at,
      label: `Draft v${lifecycle.workingDraftVersion}`,
    });
  } else if (lifecycle.currentApprovedBaselineVersion == null) {
    versions.push({
      version: 1,
      kind: "draft",
      status: "draft",
      items: tipItems,
      createdAt: at,
      label: "Initial draft",
    });
  }

  return {
    mediaPlanId: campaignObject.id,
    campaignId: options?.campaignId ?? campaignObject.id,
    campaignObjectId: campaignObject.id,
    source: "campaign",
    currentApprovedBaselineVersion: lifecycle.currentApprovedBaselineVersion,
    workingDraftVersion:
      lifecycle.workingDraftVersion ??
      (lifecycle.currentApprovedBaselineVersion == null ? 1 : null),
    versions,
    lockedAt: lifecycle.lockedAt ?? null,
    lockedBy: lifecycle.lockedBy ?? null,
  };
}

/** Baseline items for Actual/Remaining — never the in-progress draft tip when a baseline exists. */
export function baselineItemsFromState(state: MediaPlanState): MediaPlanItem[] {
  if (state.currentApprovedBaselineVersion == null) return [];
  const baseline = state.versions.find(
    (entry) => entry.version === state.currentApprovedBaselineVersion
  );
  return baseline?.items ?? [];
}
