import type { CampaignObject } from "@/features/campaign-intelligence";
import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";
import { getMediaPlanLifecycle } from "@/features/campaign-outputs/media-plan-mutations";
import { emptyMediaPlanData } from "@/lib/media-plan/calendar-adapter";
import {
  resolveApprovedBaselineData,
  resolveOriginalData,
} from "@/lib/media-plan/resolve-calendar-data";
import { mediaPlanStatusLabel, type MediaPlanStatus } from "@/lib/media-plan";

export type ClientMediaPlanPayload = {
  campaignId: string;
  campaignName: string;
  documentNumber: string | null;
  status: MediaPlanStatus;
  statusLabel: string;
  baselineVersion: number | null;
  original: MediaPlanData;
  emptyReason: string | null;
};

function emptyPayload(
  campaignId: string,
  campaignName: string,
  documentNumber: string | null,
  emptyReason: string
): ClientMediaPlanPayload {
  const start = new Date().toISOString().slice(0, 10);
  return {
    campaignId,
    campaignName,
    documentNumber,
    status: "draft",
    statusLabel: "Unavailable",
    baselineVersion: null,
    original: emptyMediaPlanData(start, 4),
    emptyReason,
  };
}

/**
 * Pure builder used by Client Portal and unit tests.
 * Portal Original = Current Approved Baseline only (never Working Draft).
 */
export function buildClientPortalOriginalPayload(input: {
  campaignId: string;
  campaignName: string;
  documentNumber: string | null;
  campaignObject: CampaignObject | null;
}): ClientMediaPlanPayload {
  const { campaignId, campaignName, documentNumber, campaignObject } = input;

  if (!campaignObject) {
    return emptyPayload(
      campaignId,
      campaignName,
      documentNumber,
      "No Media Plan is linked to this campaign yet."
    );
  }

  const lifecycle = getMediaPlanLifecycle(campaignObject);
  if (lifecycle.currentApprovedBaselineVersion == null) {
    return emptyPayload(
      campaignId,
      campaignName,
      documentNumber,
      "The Media Plan has not been approved yet. Once approved, the Original plan will appear here."
    );
  }

  const tip = resolveOriginalData(campaignObject);
  const original = resolveApprovedBaselineData(campaignObject, tip);

  return {
    campaignId,
    campaignName,
    documentNumber,
    status: lifecycle.status,
    statusLabel: mediaPlanStatusLabel(lifecycle.status),
    baselineVersion: lifecycle.currentApprovedBaselineVersion,
    original,
    emptyReason: null,
  };
}
