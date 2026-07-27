import { MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE } from "./config";
import { isEditableDraftStatus } from "./status";
import type {
  MediaPlanState,
  MediaPlanStatus,
  PrepareRegenerateResult,
  RegenerateUiState,
} from "./types";
import { ensureWorkingDraft, getWorkingDraft, getWorkingTip } from "./versioning";
import { buildMediaPlanTimelineEvent } from "./timeline-events";

export function getRegenerateUiState(status: MediaPlanStatus): RegenerateUiState {
  if (isEditableDraftStatus(status)) {
    return { visible: true, enabled: true, message: null };
  }
  return {
    visible: true,
    enabled: false,
    message: MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE,
  };
}

export function getRegenerateUiStateForPlan(state: MediaPlanState): RegenerateUiState {
  const tip = getWorkingTip(state);
  if (!tip) {
    return {
      visible: true,
      enabled: false,
      message: MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE,
    };
  }
  // Regenerate enables only when the editable working tip is Draft.
  // If only an approved baseline is showing (no draft), button is disabled.
  const draft = getWorkingDraft(state);
  if (draft && isEditableDraftStatus(draft.status)) {
    return { visible: true, enabled: true, message: null };
  }
  return getRegenerateUiState(tip.status);
}

/**
 * Resolve a regenerate intent without mutating approved baselines.
 *
 * - Draft tip: regenerate may run immediately on the working draft.
 * - Approved/Locked tip, no draft: create draft from baseline (caller regenerates draft).
 * - Draft already exists: continue that draft; never create another.
 */
export function prepareRegenerate(
  state: MediaPlanState,
  input: { at: string; actorUserId?: string | null }
): PrepareRegenerateResult {
  const draft = getWorkingDraft(state);
  if (draft && isEditableDraftStatus(draft.status)) {
    return {
      ok: true,
      state,
      draftVersion: draft.version,
      canRegenerateNow: true,
      createdDraft: false,
      events: [],
      message: null,
    };
  }

  if (draft && !isEditableDraftStatus(draft.status)) {
    return {
      ok: true,
      state,
      draftVersion: draft.version,
      canRegenerateNow: false,
      createdDraft: false,
      events: [],
      message: MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE,
    };
  }

  // No working draft — fork from baseline, then caller regenerates the draft only.
  const ensured = ensureWorkingDraft(state, {
    at: input.at,
    actorUserId: input.actorUserId,
    label: "Draft revision for regenerate",
  });
  if (!ensured.ok) {
    return { ok: false, error: ensured.error };
  }

  return {
    ok: true,
    state: ensured.state,
    draftVersion: ensured.draftVersion,
    canRegenerateNow: true,
    createdDraft: ensured.created,
    events: ensured.events,
    message: ensured.created
      ? "Created a draft revision from the approved baseline. Regenerate applies only to the draft."
      : null,
  };
}

/** Record that regenerate ran against a draft version (never a baseline). */
export function recordDraftRegenerated(
  state: MediaPlanState,
  input: { at: string; actorUserId?: string | null; draftVersion: number }
) {
  const draft = getWorkingDraft(state);
  if (!draft || draft.version !== input.draftVersion) {
    return {
      ok: false as const,
      error: "Regenerate must target the active working draft.",
    };
  }
  if (!isEditableDraftStatus(draft.status)) {
    return {
      ok: false as const,
      error: MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE,
    };
  }

  const event = buildMediaPlanTimelineEvent({
    type: "media_plan_regenerated",
    state,
    version: draft.version,
    at: input.at,
    actorUserId: input.actorUserId,
    summary: `Media Plan draft v${draft.version} regenerated`,
  });

  return { ok: true as const, events: [event] };
}
