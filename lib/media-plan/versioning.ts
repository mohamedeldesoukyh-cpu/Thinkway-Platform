import {
  MEDIA_PLAN_IMMUTABLE_BASELINE_MESSAGE,
  MEDIA_PLAN_SINGLE_DRAFT_MESSAGE,
} from "./config";
import { isApprovedStatus, isEditableDraftStatus, isImmutableStatus } from "./status";
import type {
  EnsureWorkingDraftResult,
  MediaPlanItem,
  MediaPlanState,
  MediaPlanTimelineEvent,
  MediaPlanVersionRecord,
  PromoteDraftResult,
} from "./types";
import { buildMediaPlanTimelineEvent } from "./timeline-events";

function cloneItems(items: MediaPlanItem[]): MediaPlanItem[] {
  return items.map((item) => ({ ...item }));
}

export function getVersion(
  state: MediaPlanState,
  version: number
): MediaPlanVersionRecord | undefined {
  return state.versions.find((entry) => entry.version === version);
}

export function getCurrentApprovedBaseline(
  state: MediaPlanState
): MediaPlanVersionRecord | null {
  if (state.currentApprovedBaselineVersion == null) return null;
  return getVersion(state, state.currentApprovedBaselineVersion) ?? null;
}

export function getWorkingDraft(state: MediaPlanState): MediaPlanVersionRecord | null {
  if (state.workingDraftVersion == null) return null;
  return getVersion(state, state.workingDraftVersion) ?? null;
}

/** Tip the UI edits: working draft if present, else baseline (read-only when approved). */
export function getWorkingTip(state: MediaPlanState): MediaPlanVersionRecord | null {
  return getWorkingDraft(state) ?? getCurrentApprovedBaseline(state);
}

export function assertMediaPlanInvariants(state: MediaPlanState): string[] {
  const errors: string[] = [];

  const activeBaselines = state.versions.filter((v) => v.kind === "baseline");
  if (activeBaselines.length > 1) {
    errors.push("Exactly one Current Approved Baseline kind=baseline is allowed.");
  }

  if (state.currentApprovedBaselineVersion != null) {
    const baseline = getVersion(state, state.currentApprovedBaselineVersion);
    if (!baseline) {
      errors.push("currentApprovedBaselineVersion points to a missing version.");
    } else if (baseline.kind !== "baseline") {
      errors.push("currentApprovedBaselineVersion must reference kind=baseline.");
    } else if (!isApprovedStatus(baseline.status)) {
      errors.push("Current Approved Baseline must have an approved status.");
    }
  }

  const drafts = state.versions.filter((v) => v.kind === "draft");
  if (drafts.length > 1) {
    errors.push(MEDIA_PLAN_SINGLE_DRAFT_MESSAGE);
  }
  if (state.workingDraftVersion != null) {
    const draft = getVersion(state, state.workingDraftVersion);
    if (!draft) {
      errors.push("workingDraftVersion points to a missing version.");
    } else if (draft.kind !== "draft") {
      errors.push("workingDraftVersion must reference a draft version.");
    }
  } else if (drafts.length === 1) {
    errors.push("A draft version exists but workingDraftVersion is null.");
  }

  for (const version of state.versions) {
    if (isApprovedStatus(version.status) && version.kind === "draft") {
      errors.push(`Version ${version.version}: approved status cannot remain kind=draft.`);
    }
  }

  return errors;
}

export function validateMediaPlanState(state: MediaPlanState): {
  ok: boolean;
  errors: string[];
} {
  const errors = assertMediaPlanInvariants(state);
  return { ok: errors.length === 0, errors };
}

export function assertCanMutateWorkingVersion(state: MediaPlanState): {
  ok: boolean;
  error?: string;
  draft: MediaPlanVersionRecord | null;
} {
  const draft = getWorkingDraft(state);
  if (!draft) {
    return {
      ok: false,
      error: MEDIA_PLAN_IMMUTABLE_BASELINE_MESSAGE,
      draft: null,
    };
  }
  if (!isEditableDraftStatus(draft.status)) {
    return {
      ok: false,
      error: MEDIA_PLAN_IMMUTABLE_BASELINE_MESSAGE,
      draft,
    };
  }
  return { ok: true, draft };
}

/**
 * Continue the existing Working Draft, or fork a new Draft from the Current
 * Approved Baseline (or from the latest version when no baseline yet).
 * Never creates a second concurrent draft.
 */
export function ensureWorkingDraft(
  state: MediaPlanState,
  input: {
    at: string;
    actorUserId?: string | null;
    label?: string | null;
  }
): EnsureWorkingDraftResult {
  const invariantErrors = assertMediaPlanInvariants(state);
  if (invariantErrors.length) {
    return { ok: false, error: invariantErrors[0]! };
  }

  const existing = getWorkingDraft(state);
  if (existing) {
    return {
      ok: true,
      state,
      draftVersion: existing.version,
      created: false,
      events: [],
    };
  }

  const baseline = getCurrentApprovedBaseline(state);
  const source =
    baseline ??
    [...state.versions].sort((a, b) => b.version - a.version)[0] ??
    null;

  if (!source) {
    return { ok: false, error: "Cannot create a draft: Media Plan has no source version." };
  }

  if (isImmutableStatus(source.status) === false && source.kind === "draft") {
    return { ok: false, error: MEDIA_PLAN_SINGLE_DRAFT_MESSAGE };
  }

  const nextVersion = Math.max(0, ...state.versions.map((v) => v.version)) + 1;
  const draft: MediaPlanVersionRecord = {
    version: nextVersion,
    kind: "draft",
    status: "draft",
    items: cloneItems(source.items),
    createdAt: input.at,
    createdBy: input.actorUserId ?? null,
    label: input.label ?? `Draft revision from v${source.version}`,
  };

  const nextState: MediaPlanState = {
    ...state,
    workingDraftVersion: nextVersion,
    versions: [...state.versions, draft],
  };

  const events: MediaPlanTimelineEvent[] = [
    buildMediaPlanTimelineEvent({
      type: "draft_created",
      state: nextState,
      version: nextVersion,
      at: input.at,
      actorUserId: input.actorUserId,
      summary: `Working draft v${nextVersion} created from v${source.version}`,
      previousValue: { version: source.version, status: source.status },
      newValue: { version: nextVersion, status: "draft" },
    }),
    buildMediaPlanTimelineEvent({
      type: "revision_created",
      state: nextState,
      version: nextVersion,
      at: input.at,
      actorUserId: input.actorUserId,
      summary: `Revision v${nextVersion} opened for editing`,
    }),
  ];

  const check = validateMediaPlanState(nextState);
  if (!check.ok) {
    return { ok: false, error: check.errors[0]! };
  }

  return {
    ok: true,
    state: nextState,
    draftVersion: nextVersion,
    created: true,
    events,
  };
}

/**
 * Promote the Working Draft to the new Current Approved Baseline.
 * Previous baseline is archived; draft pointer cleared.
 */
export function promoteWorkingDraftToBaseline(
  state: MediaPlanState,
  input: {
    at: string;
    actorUserId?: string | null;
    approvalMethod: "client_portal" | "on_behalf";
    approvalSource?: MediaPlanVersionRecord["approvalSource"];
    notes?: string | null;
  }
): PromoteDraftResult {
  const draft = getWorkingDraft(state);
  if (!draft) {
    return { ok: false, error: "No working draft to promote." };
  }
  if (!isEditableDraftStatus(draft.status) && draft.status !== "locked") {
    return { ok: false, error: "Only a draft or locked plan can be approved." };
  }

  const previousBaselineVersion = state.currentApprovedBaselineVersion;
  const approvalStatus =
    input.approvalMethod === "client_portal"
      ? ("approved_by_client" as const)
      : ("approved_on_behalf" as const);

  const versions = state.versions.map((entry) => {
    if (previousBaselineVersion != null && entry.version === previousBaselineVersion) {
      return { ...entry, kind: "archived_baseline" as const };
    }
    if (entry.version === draft.version) {
      return {
        ...entry,
        kind: "baseline" as const,
        status: approvalStatus,
        approvedAt: input.at,
        approvalMethod: input.approvalMethod,
        approvalSource: input.approvalSource ?? null,
        approvedBy: input.actorUserId ?? null,
        notes: input.notes ?? null,
        label: entry.label ?? `Approved v${entry.version}`,
      };
    }
    return entry;
  });

  const nextState: MediaPlanState = {
    ...state,
    currentApprovedBaselineVersion: draft.version,
    workingDraftVersion: null,
    versions,
    lockedAt: input.at,
    lockedBy: input.actorUserId ?? null,
  };

  const events: MediaPlanTimelineEvent[] = [
    buildMediaPlanTimelineEvent({
      type: input.approvalMethod === "client_portal" ? "client_approved" : "approved_on_behalf",
      state: nextState,
      version: draft.version,
      at: input.at,
      actorUserId: input.actorUserId,
      summary:
        input.approvalMethod === "client_portal"
          ? `Media Plan v${draft.version} approved by client`
          : `Media Plan v${draft.version} approved on behalf of client`,
      previousValue: previousBaselineVersion,
      newValue: draft.version,
    }),
    buildMediaPlanTimelineEvent({
      type: "baseline_published",
      state: nextState,
      version: draft.version,
      at: input.at,
      actorUserId: input.actorUserId,
      summary: `v${draft.version} published as Current Approved Baseline`,
    }),
  ];

  const check = validateMediaPlanState(nextState);
  if (!check.ok) {
    return { ok: false, error: check.errors[0]! };
  }

  return {
    ok: true,
    state: nextState,
    baselineVersion: draft.version,
    events,
  };
}

/** Lock the working draft (awaiting client approval). Calendar becomes read-only. */
export function lockWorkingDraft(
  state: MediaPlanState,
  input: { at: string; actorUserId?: string | null }
):
  | { ok: true; state: MediaPlanState; events: MediaPlanTimelineEvent[] }
  | { ok: false; error: string } {
  const draft = getWorkingDraft(state);
  if (!draft) {
    return { ok: false, error: "No working draft to lock." };
  }
  if (!isEditableDraftStatus(draft.status)) {
    return { ok: false, error: "Only a draft Media Plan can be locked." };
  }

  const versions = state.versions.map((entry) =>
    entry.version === draft.version ? { ...entry, status: "locked" as const } : entry
  );
  const nextState: MediaPlanState = {
    ...state,
    versions,
    lockedAt: input.at,
    lockedBy: input.actorUserId ?? null,
  };

  return {
    ok: true,
    state: nextState,
    events: [
      buildMediaPlanTimelineEvent({
        type: "media_plan_locked",
        state: nextState,
        version: draft.version,
        at: input.at,
        actorUserId: input.actorUserId,
        summary: `Media Plan draft v${draft.version} locked`,
      }),
    ],
  };
}

/** Replace items on the working draft only. */
export function replaceWorkingDraftItems(
  state: MediaPlanState,
  items: MediaPlanItem[],
  input: { at: string; actorUserId?: string | null }
):
  | { ok: true; state: MediaPlanState; events: MediaPlanTimelineEvent[] }
  | { ok: false; error: string } {
  const mutable = assertCanMutateWorkingVersion(state);
  if (!mutable.ok || !mutable.draft) {
    return { ok: false, error: mutable.error ?? MEDIA_PLAN_IMMUTABLE_BASELINE_MESSAGE };
  }

  const versions = state.versions.map((entry) =>
    entry.version === mutable.draft!.version
      ? { ...entry, items: cloneItems(items) }
      : entry
  );

  const nextState: MediaPlanState = { ...state, versions };
  const events = [
    buildMediaPlanTimelineEvent({
      type: "schedule_edited",
      state: nextState,
      version: mutable.draft.version,
      at: input.at,
      actorUserId: input.actorUserId,
      summary: `Draft v${mutable.draft.version} schedule updated`,
    }),
  ];

  return { ok: true, state: nextState, events };
}

export function createInitialMediaPlanState(input: {
  mediaPlanId: string;
  campaignId: string;
  campaignObjectId: string;
  source: "studio" | "campaign";
  items: MediaPlanItem[];
  at: string;
  actorUserId?: string | null;
}): { state: MediaPlanState; events: MediaPlanTimelineEvent[] } {
  const version: MediaPlanVersionRecord = {
    version: 1,
    kind: "draft",
    status: "draft",
    items: cloneItems(input.items),
    createdAt: input.at,
    createdBy: input.actorUserId ?? null,
    label: "Initial draft",
  };

  const state: MediaPlanState = {
    mediaPlanId: input.mediaPlanId,
    campaignId: input.campaignId,
    campaignObjectId: input.campaignObjectId,
    source: input.source,
    currentApprovedBaselineVersion: null,
    workingDraftVersion: 1,
    versions: [version],
  };

  const events = [
    buildMediaPlanTimelineEvent({
      type: "media_plan_created",
      state,
      version: 1,
      at: input.at,
      actorUserId: input.actorUserId,
      summary: "Media Plan created",
    }),
  ];

  return { state, events };
}
