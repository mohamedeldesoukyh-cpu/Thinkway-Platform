import type { CampaignObject } from "@/features/campaign-intelligence";
import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";
import { getMediaPlanLifecycle } from "@/features/campaign-outputs/media-plan-mutations";
import { emptyMediaPlanData } from "@/lib/media-plan/calendar-adapter";
import {
  resolveApprovedBaselineData,
  resolveOriginalData,
} from "@/lib/media-plan/resolve-calendar-data";
import { mediaPlanStatusLabel, type MediaPlanStatus } from "@/lib/media-plan";

export type ClientMediaPlanViewMode = "approved_original" | "pending_review";

export type ClientMediaPlanPayload = {
  campaignId: string;
  campaignName: string;
  documentNumber: string | null;
  campaignObjectId: string | null;
  conversationId: string | null;
  status: MediaPlanStatus;
  statusLabel: string;
  baselineVersion: number | null;
  viewMode: ClientMediaPlanViewMode | null;
  original: MediaPlanData;
  emptyReason: string | null;
  /** True when client has approve role and plan awaits a portal decision. */
  canDecide: boolean;
  canApprove: boolean;
  canRequestChanges: boolean;
  canReject: boolean;
};

function emptyPayload(
  campaignId: string,
  campaignName: string,
  documentNumber: string | null,
  emptyReason: string,
  ids?: { campaignObjectId?: string | null; conversationId?: string | null }
): ClientMediaPlanPayload {
  const start = new Date().toISOString().slice(0, 10);
  return {
    campaignId,
    campaignName,
    documentNumber,
    campaignObjectId: ids?.campaignObjectId ?? null,
    conversationId: ids?.conversationId ?? null,
    status: "draft",
    statusLabel: "Unavailable",
    baselineVersion: null,
    viewMode: null,
    original: emptyMediaPlanData(start, 4),
    emptyReason,
    canDecide: false,
    canApprove: false,
    canRequestChanges: false,
    canReject: false,
  };
}

function decisionFlags(
  status: MediaPlanStatus,
  hasApproveRole: boolean
): Pick<
  ClientMediaPlanPayload,
  "canDecide" | "canApprove" | "canRequestChanges" | "canReject"
> {
  if (!hasApproveRole) {
    return {
      canDecide: false,
      canApprove: false,
      canRequestChanges: false,
      canReject: false,
    };
  }

  const awaiting = status === "locked" || status === "pending_approval";
  const approved = status === "approved_by_client" || status === "approved_on_behalf";

  return {
    canDecide: awaiting || approved,
    // Portal approve only when the tip is locked for client review (not an open draft).
    canApprove: awaiting,
    canRequestChanges: awaiting || approved,
    canReject: awaiting,
  };
}

/**
 * Pure builder used by Client Portal and unit tests.
 *
 * - Pending review (locked / pending_approval): show tip awaiting client decision.
 * - Otherwise with approved baseline: show Current Approved Baseline (never draft tip).
 * - Unshared draft: empty.
 */
export function buildClientPortalOriginalPayload(input: {
  campaignId: string;
  campaignName: string;
  documentNumber: string | null;
  campaignObject: CampaignObject | null;
  conversationId?: string | null;
  hasApproveRole?: boolean;
}): ClientMediaPlanPayload {
  const {
    campaignId,
    campaignName,
    documentNumber,
    campaignObject,
    conversationId = null,
    hasApproveRole = false,
  } = input;

  if (!campaignObject) {
    return emptyPayload(
      campaignId,
      campaignName,
      documentNumber,
      "No Media Plan is linked to this campaign yet."
    );
  }

  const lifecycle = getMediaPlanLifecycle(campaignObject);
  const tip = resolveOriginalData(campaignObject);
  const baseline = resolveApprovedBaselineData(campaignObject, tip);
  const awaitingClientDecision =
    lifecycle.status === "locked" || lifecycle.status === "pending_approval";
  const decisions = decisionFlags(lifecycle.status, hasApproveRole);

  if (awaitingClientDecision) {
    return {
      campaignId,
      campaignName,
      documentNumber,
      campaignObjectId: campaignObject.id,
      conversationId: conversationId ?? campaignObject.conversationId ?? null,
      status: lifecycle.status,
      statusLabel: mediaPlanStatusLabel(lifecycle.status),
      baselineVersion: lifecycle.currentApprovedBaselineVersion,
      viewMode: "pending_review",
      original: tip,
      emptyReason: null,
      ...decisions,
    };
  }

  if (lifecycle.currentApprovedBaselineVersion == null) {
    return emptyPayload(
      campaignId,
      campaignName,
      documentNumber,
      "The Media Plan is not ready for client review yet. Once it is locked for approval or approved, it will appear here.",
      {
        campaignObjectId: campaignObject.id,
        conversationId: conversationId ?? campaignObject.conversationId ?? null,
      }
    );
  }

  return {
    campaignId,
    campaignName,
    documentNumber,
    campaignObjectId: campaignObject.id,
    conversationId: conversationId ?? campaignObject.conversationId ?? null,
    status: lifecycle.status,
    statusLabel: mediaPlanStatusLabel(lifecycle.status),
    baselineVersion: lifecycle.currentApprovedBaselineVersion,
    viewMode: "approved_original",
    original: baseline,
    emptyReason: null,
    ...decisions,
  };
}
