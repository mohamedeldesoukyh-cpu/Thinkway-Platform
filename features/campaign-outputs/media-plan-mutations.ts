/**
 * Studio / Campaign write facade for Media Plan schedule mutations.
 *
 * ALL production schedule writes must go through this module so the Media Plan
 * Engine enforces: immutable approved baseline, ≤1 working draft, ownership.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  MEDIA_PLAN_IMMUTABLE_BASELINE_MESSAGE,
  MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE,
  assertSourceCanMutateMediaPlanSchedule,
  isApprovedStatus,
  isEditableDraftStatus,
  isImmutableStatus,
  type MediaPlanMutationSource,
  type MediaPlanStatus,
  type MediaPlanTimelineEvent,
} from "@/lib/media-plan";
import {
  cloneJson,
  createDefaultMediaPlanLifecycle,
  type MediaPlanLifecycleMeta,
} from "@/lib/media-plan/lifecycle-meta";

import {
  applyMediaPlanScheduleChangeUnchecked,
  cloneMediaPlanScheduleMeta,
  type MediaPlanScheduleMeta,
  type RescheduleMediaPlanInput,
  type RescheduleMediaPlanResult,
} from "./media-plan-schedule";

export type MediaPlanMutationOptions = {
  source: MediaPlanMutationSource;
  at?: string;
  actorUserId?: string | null;
  /**
   * When tip is locked/approved, automatically fork (or continue) a working draft
   * before applying the mutation. Default true for interactive edits.
   */
  autoForkDraft?: boolean;
};

export type MediaPlanMutationResult =
  | {
      ok: true;
      campaignObject: CampaignObject;
      change: string | null;
      forkedDraft: boolean;
      draftVersion: number | null;
      events: MediaPlanTimelineEvent[];
    }
  | { ok: false; message: string };

function nowIso(at?: string): string {
  return at ?? new Date().toISOString();
}

export function getMediaPlanLifecycle(
  campaignObject: CampaignObject
): MediaPlanLifecycleMeta {
  const existing = campaignObject.meta.mediaPlanLifecycle;
  if (existing) return existing;
  return createDefaultMediaPlanLifecycle(campaignObject.updatedAt || nowIso());
}

export function getMediaPlanWorkingStatus(campaignObject: CampaignObject): MediaPlanStatus {
  return getMediaPlanLifecycle(campaignObject).status;
}

export function ensureMediaPlanLifecycle(
  campaignObject: CampaignObject,
  at?: string
): CampaignObject {
  if (campaignObject.meta.mediaPlanLifecycle) return campaignObject;
  const lifecycle = createDefaultMediaPlanLifecycle(nowIso(at));
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      mediaPlanLifecycle: lifecycle,
    },
  };
}

function withLifecycle(
  campaignObject: CampaignObject,
  lifecycle: MediaPlanLifecycleMeta
): CampaignObject {
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      mediaPlanLifecycle: lifecycle,
    },
    updatedAt: nowIso(),
  };
}

function nextVersionNumber(lifecycle: MediaPlanLifecycleMeta): number {
  const fromHistory = lifecycle.history.reduce((max, entry) => Math.max(max, entry.version), 0);
  const fromBaseline = lifecycle.currentApprovedBaselineVersion ?? 0;
  const fromDraft = lifecycle.workingDraftVersion ?? 0;
  return Math.max(fromHistory, fromBaseline, fromDraft) + 1;
}

function snapshotKey(version: number): string {
  return String(version);
}

/**
 * Continue existing Working Draft, or fork a new Draft from the Current Approved
 * Baseline. Never creates a second concurrent draft.
 */
export function ensureWorkingDraftOnCampaignObject(
  campaignObject: CampaignObject,
  input: { at?: string; actorUserId?: string | null; label?: string | null }
): MediaPlanMutationResult {
  const at = nowIso(input.at);
  let next = ensureMediaPlanLifecycle(campaignObject, at);
  const lifecycle = cloneJson(getMediaPlanLifecycle(next));

  // At most one working draft — continue it whenever the pointer exists.
  if (lifecycle.workingDraftVersion != null) {
    return {
      ok: true,
      campaignObject: next,
      change: null,
      forkedDraft: false,
      draftVersion: lifecycle.workingDraftVersion,
      events: [],
    };
  }

  const baselineVersion = lifecycle.currentApprovedBaselineVersion;
  const baselineSchedule =
    baselineVersion != null
      ? (lifecycle.approvedScheduleSnapshots[snapshotKey(baselineVersion)] as
          | MediaPlanScheduleMeta
          | undefined)
      : undefined;

  const sourceSchedule =
    baselineSchedule ??
    (next.meta.mediaPlanSchedule ? cloneMediaPlanScheduleMeta(next.meta.mediaPlanSchedule) : {});

  const draftVersion = nextVersionNumber(lifecycle);
  lifecycle.workingDraftVersion = draftVersion;
  lifecycle.status = "draft";
  lifecycle.lockedAt = null;
  lifecycle.lockedBy = null;
  lifecycle.history = [
    ...lifecycle.history,
    {
      version: draftVersion,
      kind: "draft",
      status: "draft",
      at,
      label: input.label ?? `Draft revision from v${baselineVersion ?? 0}`,
      actorUserId: input.actorUserId ?? null,
    },
  ];

  next = {
    ...withLifecycle(next, lifecycle),
    meta: {
      ...withLifecycle(next, lifecycle).meta,
      mediaPlanSchedule: cloneMediaPlanScheduleMeta(sourceSchedule),
    },
  };

  return {
    ok: true,
    campaignObject: next,
    change: `Created working draft v${draftVersion}`,
    forkedDraft: true,
    draftVersion,
    events: [
      {
        type: "draft_created",
        mediaPlanId: next.id,
        campaignId: next.id,
        version: draftVersion,
        at,
        actorUserId: input.actorUserId ?? null,
        summary: `Working draft v${draftVersion} created`,
        previousValue: baselineVersion,
        newValue: draftVersion,
      },
      {
        type: "revision_created",
        mediaPlanId: next.id,
        campaignId: next.id,
        version: draftVersion,
        at,
        actorUserId: input.actorUserId ?? null,
        summary: `Revision v${draftVersion} opened for editing`,
      },
    ],
  };
}

/**
 * Guarded schedule mutation — the only supported write path for mediaPlanSchedule.
 */
export function mutateMediaPlanSchedule(
  campaignObject: CampaignObject,
  input: RescheduleMediaPlanInput,
  options: MediaPlanMutationOptions
): MediaPlanMutationResult {
  const ownership = assertSourceCanMutateMediaPlanSchedule(options.source);
  if (!ownership.ok) {
    return { ok: false, message: ownership.error };
  }

  const at = nowIso(options.at);
  let next = ensureMediaPlanLifecycle(campaignObject, at);
  let lifecycle = getMediaPlanLifecycle(next);
  let forkedDraft = false;
  let events: MediaPlanTimelineEvent[] = [];

  if (isImmutableStatus(lifecycle.status) || isApprovedStatus(lifecycle.status)) {
    if (options.autoForkDraft === false) {
      return { ok: false, message: MEDIA_PLAN_IMMUTABLE_BASELINE_MESSAGE };
    }
    const forked = ensureWorkingDraftOnCampaignObject(next, {
      at,
      actorUserId: options.actorUserId,
    });
    if (!forked.ok) return forked;
    next = forked.campaignObject;
    lifecycle = getMediaPlanLifecycle(next);
    forkedDraft = forked.forkedDraft;
    events = [...events, ...forked.events];
  }

  if (!isEditableDraftStatus(lifecycle.status)) {
    return {
      ok: false,
      message:
        lifecycle.status === "locked"
          ? "This Media Plan is locked. Unlock and continue the working draft to make changes."
          : MEDIA_PLAN_IMMUTABLE_BASELINE_MESSAGE,
    };
  }

  const applied = applyMediaPlanScheduleChangeUnchecked(next, input);
  if (!applied.change) {
    return {
      ok: true,
      campaignObject: applied.campaignObject,
      change: null,
      forkedDraft,
      draftVersion: lifecycle.workingDraftVersion,
      events,
    };
  }

  const withEvents: MediaPlanTimelineEvent[] = [
    ...events,
    {
      type: "schedule_edited",
      mediaPlanId: applied.campaignObject.id,
      campaignId: applied.campaignObject.id,
      version: lifecycle.workingDraftVersion,
      at,
      actorUserId: options.actorUserId ?? null,
      summary: applied.change,
    },
  ];

  return {
    ok: true,
    campaignObject: applied.campaignObject,
    change: applied.change,
    forkedDraft,
    draftVersion: lifecycle.workingDraftVersion,
    events: withEvents,
  };
}

export function lockMediaPlanOnCampaignObject(
  campaignObject: CampaignObject,
  input: { at?: string; actorUserId?: string | null }
): MediaPlanMutationResult {
  const at = nowIso(input.at);
  let next = ensureMediaPlanLifecycle(campaignObject, at);
  const lifecycle = cloneJson(getMediaPlanLifecycle(next));

  if (!isEditableDraftStatus(lifecycle.status)) {
    return { ok: false, message: "Only a draft Media Plan can be locked." };
  }

  lifecycle.status = "locked";
  lifecycle.lockedAt = at;
  lifecycle.lockedBy = input.actorUserId ?? null;
  lifecycle.history = [
    ...lifecycle.history,
    {
      version: lifecycle.workingDraftVersion ?? nextVersionNumber(lifecycle),
      kind: "draft",
      status: "locked",
      at,
      label: "Locked",
      actorUserId: input.actorUserId ?? null,
    },
  ];

  next = withLifecycle(next, lifecycle);
  return {
    ok: true,
    campaignObject: next,
    change: "Media Plan locked",
    forkedDraft: false,
    draftVersion: lifecycle.workingDraftVersion,
    events: [
      {
        type: "media_plan_locked",
        mediaPlanId: next.id,
        campaignId: next.id,
        version: lifecycle.workingDraftVersion,
        at,
        actorUserId: input.actorUserId ?? null,
        summary: "Media Plan locked",
      },
    ],
  };
}

/**
 * Unlock: if approved, fork a new draft (baseline stays frozen). If locked draft,
 * return it to draft status.
 */
export function unlockMediaPlanOnCampaignObject(
  campaignObject: CampaignObject,
  input: { at?: string; actorUserId?: string | null; reason?: string | null }
): MediaPlanMutationResult {
  const at = nowIso(input.at);
  let next = ensureMediaPlanLifecycle(campaignObject, at);
  const lifecycle = cloneJson(getMediaPlanLifecycle(next));

  if (isApprovedStatus(lifecycle.status)) {
    const forked = ensureWorkingDraftOnCampaignObject(next, {
      at,
      actorUserId: input.actorUserId,
      label: "Unlocked revision",
    });
    if (!forked.ok) return forked;
    // Mark pending approval on the new draft tip
    const draftLifecycle = cloneJson(getMediaPlanLifecycle(forked.campaignObject));
    draftLifecycle.status = "draft";
    const unlocked = withLifecycle(forked.campaignObject, draftLifecycle);
    return {
      ok: true,
      campaignObject: unlocked,
      change: "Unlocked approved Media Plan into a new working draft",
      forkedDraft: true,
      draftVersion: draftLifecycle.workingDraftVersion,
      events: [
        ...forked.events,
        {
          type: "media_plan_unlocked",
          mediaPlanId: unlocked.id,
          campaignId: unlocked.id,
          version: draftLifecycle.workingDraftVersion,
          at,
          actorUserId: input.actorUserId ?? null,
          summary: input.reason
            ? `Media Plan unlocked: ${input.reason}`
            : "Media Plan unlocked; approved baseline preserved",
        },
      ],
    };
  }

  if (lifecycle.status !== "locked") {
    return { ok: false, message: "Media Plan is not locked." };
  }

  lifecycle.status = "draft";
  lifecycle.lockedAt = null;
  lifecycle.lockedBy = null;
  next = withLifecycle(next, lifecycle);

  return {
    ok: true,
    campaignObject: next,
    change: "Media Plan unlocked",
    forkedDraft: false,
    draftVersion: lifecycle.workingDraftVersion,
    events: [
      {
        type: "media_plan_unlocked",
        mediaPlanId: next.id,
        campaignId: next.id,
        version: lifecycle.workingDraftVersion,
        at,
        actorUserId: input.actorUserId ?? null,
        summary: input.reason ? `Media Plan unlocked: ${input.reason}` : "Media Plan unlocked",
      },
    ],
  };
}

export function approveMediaPlanOnCampaignObject(
  campaignObject: CampaignObject,
  input: {
    at?: string;
    actorUserId?: string | null;
    method: "client_portal" | "on_behalf";
    approvalSource?: string | null;
    notes?: string | null;
  }
): MediaPlanMutationResult {
  const at = nowIso(input.at);
  let next = ensureMediaPlanLifecycle(campaignObject, at);
  const lifecycle = cloneJson(getMediaPlanLifecycle(next));

  if (lifecycle.status !== "draft" && lifecycle.status !== "locked") {
    return { ok: false, message: "Only a draft or locked Media Plan can be approved." };
  }

  const version = lifecycle.workingDraftVersion ?? nextVersionNumber(lifecycle);
  const schedule = next.meta.mediaPlanSchedule
    ? cloneMediaPlanScheduleMeta(next.meta.mediaPlanSchedule)
    : {};

  // Freeze immutable snapshot — never overwrite an existing approved snapshot.
  const key = snapshotKey(version);
  if (lifecycle.approvedScheduleSnapshots[key]) {
    return { ok: false, message: "Approved version snapshot already exists and is immutable." };
  }
  lifecycle.approvedScheduleSnapshots[key] = schedule;

  if (lifecycle.currentApprovedBaselineVersion != null) {
    // prior baseline remains in snapshots + history as archived
    lifecycle.history = lifecycle.history.map((entry) =>
      entry.version === lifecycle.currentApprovedBaselineVersion && entry.kind === "baseline"
        ? { ...entry, kind: "archived_baseline" as const }
        : entry
    );
  }

  const status: MediaPlanStatus =
    input.method === "client_portal" ? "approved_by_client" : "approved_on_behalf";

  lifecycle.currentApprovedBaselineVersion = version;
  lifecycle.workingDraftVersion = null;
  lifecycle.status = status;
  lifecycle.lockedAt = at;
  lifecycle.lockedBy = input.actorUserId ?? null;
  lifecycle.history = [
    ...lifecycle.history,
    {
      version,
      kind: "baseline",
      status,
      at,
      label: status === "approved_by_client" ? "Approved by Client" : "Approved on Behalf of Client",
      actorUserId: input.actorUserId ?? null,
    },
  ];

  next = withLifecycle(next, lifecycle);

  return {
    ok: true,
    campaignObject: next,
    change: `Media Plan v${version} approved`,
    forkedDraft: false,
    draftVersion: null,
    events: [
      {
        type: input.method === "client_portal" ? "client_approved" : "approved_on_behalf",
        mediaPlanId: next.id,
        campaignId: next.id,
        version,
        at,
        actorUserId: input.actorUserId ?? null,
        summary: `Media Plan v${version} ${status}`,
        newValue: { approvalSource: input.approvalSource, notes: input.notes },
      },
      {
        type: "baseline_published",
        mediaPlanId: next.id,
        campaignId: next.id,
        version,
        at,
        actorUserId: input.actorUserId ?? null,
        summary: `v${version} published as Current Approved Baseline`,
      },
    ],
  };
}

/**
 * Request changes — unlock/fork into an editable Working Draft.
 * Approved baseline remains frozen.
 */
export function requestChangesMediaPlanOnCampaignObject(
  campaignObject: CampaignObject,
  input: { at?: string; actorUserId?: string | null; notes?: string | null }
): MediaPlanMutationResult {
  const at = nowIso(input.at);
  let next = ensureMediaPlanLifecycle(campaignObject, at);
  const lifecycle = cloneJson(getMediaPlanLifecycle(next));

  if (isApprovedStatus(lifecycle.status)) {
    const forked = ensureWorkingDraftOnCampaignObject(next, {
      at,
      actorUserId: input.actorUserId,
      label: "Changes requested",
    });
    if (!forked.ok) return forked;
    // Fork preserves baseline; tip must be editable draft (not pending_approval).
    const draftLifecycle = cloneJson(getMediaPlanLifecycle(forked.campaignObject));
    draftLifecycle.status = "draft";
    draftLifecycle.lockedAt = null;
    draftLifecycle.lockedBy = null;
    next = withLifecycle(forked.campaignObject, draftLifecycle);
    return {
      ok: true,
      campaignObject: next,
      change: "Changes requested — working draft opened",
      forkedDraft: forked.forkedDraft,
      draftVersion: draftLifecycle.workingDraftVersion,
      events: [
        ...forked.events,
        {
          type: "changes_requested",
          mediaPlanId: next.id,
          campaignId: next.id,
          version: draftLifecycle.workingDraftVersion,
          at,
          actorUserId: input.actorUserId ?? null,
          summary: input.notes
            ? `Changes requested: ${input.notes}`
            : "Changes requested on approved Media Plan",
          newValue: { notes: input.notes },
        },
      ],
    };
  }

  if (lifecycle.status !== "locked" && lifecycle.status !== "pending_approval") {
    return {
      ok: false,
      message: "Changes can only be requested on a locked or approved Media Plan.",
    };
  }

  lifecycle.status = "draft";
  lifecycle.lockedAt = null;
  lifecycle.lockedBy = null;
  lifecycle.history = [
    ...lifecycle.history,
    {
      version: lifecycle.workingDraftVersion ?? nextVersionNumber(lifecycle),
      kind: "draft",
      status: "draft",
      at,
      label: "Changes requested",
      actorUserId: input.actorUserId ?? null,
    },
  ];
  next = withLifecycle(next, lifecycle);

  return {
    ok: true,
    campaignObject: next,
    change: "Changes requested — Media Plan returned to draft",
    forkedDraft: false,
    draftVersion: lifecycle.workingDraftVersion,
    events: [
      {
        type: "changes_requested",
        mediaPlanId: next.id,
        campaignId: next.id,
        version: lifecycle.workingDraftVersion,
        at,
        actorUserId: input.actorUserId ?? null,
        summary: input.notes
          ? `Changes requested: ${input.notes}`
          : "Changes requested — plan returned to draft",
        newValue: { notes: input.notes },
      },
    ],
  };
}

/**
 * Reject a locked Media Plan awaiting approval — returns Working Draft to draft.
 * Does not mutate any approved baseline.
 */
export function rejectMediaPlanOnCampaignObject(
  campaignObject: CampaignObject,
  input: { at?: string; actorUserId?: string | null; notes?: string | null }
): MediaPlanMutationResult {
  const at = nowIso(input.at);
  let next = ensureMediaPlanLifecycle(campaignObject, at);
  const lifecycle = cloneJson(getMediaPlanLifecycle(next));

  if (lifecycle.status !== "locked" && lifecycle.status !== "pending_approval") {
    return {
      ok: false,
      message: "Only a locked Media Plan awaiting approval can be rejected.",
    };
  }

  lifecycle.status = "draft";
  lifecycle.lockedAt = null;
  lifecycle.lockedBy = null;
  lifecycle.history = [
    ...lifecycle.history,
    {
      version: lifecycle.workingDraftVersion ?? nextVersionNumber(lifecycle),
      kind: "draft",
      status: "draft",
      at,
      label: "Rejected",
      actorUserId: input.actorUserId ?? null,
    },
  ];
  next = withLifecycle(next, lifecycle);

  return {
    ok: true,
    campaignObject: next,
    change: "Media Plan rejected — returned to draft",
    forkedDraft: false,
    draftVersion: lifecycle.workingDraftVersion,
    events: [
      {
        type: "rejected",
        mediaPlanId: next.id,
        campaignId: next.id,
        version: lifecycle.workingDraftVersion,
        at,
        actorUserId: input.actorUserId ?? null,
        summary: input.notes ? `Media Plan rejected: ${input.notes}` : "Media Plan rejected",
        newValue: { notes: input.notes },
      },
    ],
  };
}

export type PrepareMediaPlanRegenerateResult =
  | {
      ok: true;
      campaignObject: CampaignObject;
      canRegenerateNow: boolean;
      createdDraft: boolean;
      draftVersion: number | null;
      message: string | null;
      events: MediaPlanTimelineEvent[];
    }
  | { ok: false; message: string };

/**
 * Regenerate policy for Media Plan:
 * - Draft → regenerate allowed on working tip
 * - Locked / Approved → never mutate baseline; create or continue draft first
 */
export function prepareMediaPlanRegenerate(
  campaignObject: CampaignObject,
  input: { at?: string; actorUserId?: string | null }
): PrepareMediaPlanRegenerateResult {
  const at = nowIso(input.at);
  const next = ensureMediaPlanLifecycle(campaignObject, at);
  const lifecycle = getMediaPlanLifecycle(next);

  if (isEditableDraftStatus(lifecycle.status) && lifecycle.workingDraftVersion != null) {
    return {
      ok: true,
      campaignObject: next,
      canRegenerateNow: true,
      createdDraft: false,
      draftVersion: lifecycle.workingDraftVersion,
      message: null,
      events: [],
    };
  }

  if (lifecycle.status === "locked") {
    // Locked: do not regenerate in place. Caller must unlock or we fork? PRD: disabled.
    // If draft exists under locked, still disabled until draft status.
    return {
      ok: true,
      campaignObject: next,
      canRegenerateNow: false,
      createdDraft: false,
      draftVersion: lifecycle.workingDraftVersion,
      message: MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE,
      events: [],
    };
  }

  if (isApprovedStatus(lifecycle.status) || lifecycle.status === "pending_approval") {
    const forked = ensureWorkingDraftOnCampaignObject(next, {
      at,
      actorUserId: input.actorUserId,
      label: "Draft revision for regenerate",
    });
    if (!forked.ok) return { ok: false, message: forked.message };
    return {
      ok: true,
      campaignObject: forked.campaignObject,
      canRegenerateNow: true,
      createdDraft: forked.forkedDraft,
      draftVersion: forked.draftVersion,
      message: forked.forkedDraft
        ? "Created a draft revision from the approved baseline. Regenerate applies only to the draft."
        : null,
      events: forked.events,
    };
  }

  return {
    ok: true,
    campaignObject: next,
    canRegenerateNow: true,
    createdDraft: false,
    draftVersion: lifecycle.workingDraftVersion,
    message: null,
    events: [],
  };
}

export function getMediaPlanRegenerateUiState(campaignObject: CampaignObject): {
  visible: true;
  enabled: boolean;
  message: string | null;
} {
  const lifecycle = getMediaPlanLifecycle(ensureMediaPlanLifecycle(campaignObject));
  if (isEditableDraftStatus(lifecycle.status)) {
    return { visible: true, enabled: true, message: null };
  }
  return {
    visible: true,
    enabled: false,
    message: MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE,
  };
}

/** Approved baseline schedule — never the in-progress draft tip. */
export function getApprovedBaselineSchedule(
  campaignObject: CampaignObject
): MediaPlanScheduleMeta | null {
  const lifecycle = getMediaPlanLifecycle(campaignObject);
  const version = lifecycle.currentApprovedBaselineVersion;
  if (version == null) return null;
  const snap = lifecycle.approvedScheduleSnapshots[snapshotKey(version)];
  return snap ? cloneMediaPlanScheduleMeta(snap as MediaPlanScheduleMeta) : null;
}

/**
 * Compatibility wrapper used by legacy call sites.
 * Always routes through the Engine mutation facade.
 */
export function applyMediaPlanScheduleChange(
  campaignObject: CampaignObject,
  input: RescheduleMediaPlanInput,
  options?: Partial<MediaPlanMutationOptions>
): RescheduleMediaPlanResult {
  const result = mutateMediaPlanSchedule(campaignObject, input, {
    source: options?.source ?? "studio_media_plan_ui",
    at: options?.at,
    actorUserId: options?.actorUserId,
    autoForkDraft: options?.autoForkDraft ?? true,
  });

  if (!result.ok) {
    return { campaignObject, change: null };
  }

  return {
    campaignObject: result.campaignObject,
    change: result.change,
  };
}
