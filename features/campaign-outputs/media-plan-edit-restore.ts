/**
 * Restore Media Plan tip from Edit History (append-only).
 * Spec: docs/architecture/PRODUCTIVITY_NAVIGATION_UX_SPRINT.md
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { isApprovedStatus } from "@/lib/media-plan";

import { restoreMediaPlanEditOnRecord } from "./media-plan-edit-history";
import {
  ensureWorkingDraftOnCampaignObject,
  getMediaPlanLifecycle,
} from "./media-plan-mutations";
import { getCampaignOutputState } from "./output-registry";
import type { CampaignOutputRecord } from "./output-types";

export type RestoreMediaPlanEditOnObjectResult = {
  campaignObject: CampaignObject;
  record: CampaignOutputRecord;
  forkedFromApproved: boolean;
};

/**
 * Restore an Edit History snapshot onto the working tip.
 * - Working tip (Draft / Under Review): mutate tip + append edit; no business bump.
 * - Approved tip: fork working draft first, then restore onto the draft.
 */
export function restoreMediaPlanEditOnCampaignObject(
  campaignObject: CampaignObject,
  editNumber: number,
  options?: {
    now?: string;
    actorUserId?: string | null;
    actorLabel?: string | null;
  }
): RestoreMediaPlanEditOnObjectResult | { ok: false; message: string } {
  const lifecycle = getMediaPlanLifecycle(campaignObject);
  let working = campaignObject;
  let forkedFromApproved = false;

  if (isApprovedStatus(lifecycle.status) && lifecycle.workingDraftVersion == null) {
    const forked = ensureWorkingDraftOnCampaignObject(working, {
      actorUserId: options?.actorUserId,
      label: `Restore Edit ${editNumber}`,
      businessOperation: "revise",
      changeReason: `Working draft opened to restore Edit ${editNumber}.`,
      changeSummary: `Forked from approved baseline to restore Edit ${editNumber}.`,
    });
    if (!forked.ok) {
      return { ok: false, message: forked.message ?? "Could not open working draft." };
    }
    working = forked.campaignObject;
    forkedFromApproved = forked.forkedDraft;
  }

  const state = getCampaignOutputState(working);
  const tip = state.media_plan;
  if (!tip) return { ok: false, message: "Media Plan not found." };

  const restored = restoreMediaPlanEditOnRecord(tip, editNumber, {
    at: options?.now,
    actorKind: "user",
    actorUserId: options?.actorUserId,
    actorLabel: options?.actorLabel,
  });
  if (!restored) {
    return { ok: false, message: `Edit ${editNumber} has no restorable snapshot.` };
  }

  const now = options?.now ?? new Date().toISOString();
  const nextObject: CampaignObject = {
    ...working,
    updatedAt: now,
    meta: {
      ...working.meta,
      campaignOutputs: { ...state, media_plan: restored.record },
    },
  };

  return {
    campaignObject: nextObject,
    record: restored.record,
    forkedFromApproved,
  };
}
