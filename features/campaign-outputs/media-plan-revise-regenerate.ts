/**
 * Media Plan working edits vs business version operations.
 *
 * SSOT: docs/architecture/MEDIA_PLAN_VERSIONING.md
 * - Draft / Under Review: mutate tip + audit — no business version bump.
 * - Approved: immutable — fork first (revise/regenerate) as a new business version.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { isApprovedStatus } from "@/lib/media-plan";

import {
  asMediaPlanData,
  mediaPlanContentFromData,
  type MediaPlanData,
} from "./generators/media-plan";
import { enforceMediaPlanCampaignWindow } from "./media-plan-campaign-window";
import {
  buildMediaPlanEditHistoryEntry,
  withMediaPlanEditHistoryAppend,
} from "./media-plan-edit-history";
import {
  appendMediaPlanAuditEntry,
  actorKindFromOrigin,
  beginMediaPlanBusinessVersion,
  defaultApprovalImpactForOperation,
  shouldCreateNewBusinessVersion,
  syncMediaPlanBusinessStatusFromEngine,
} from "./media-plan-versioning";
import {
  ensureWorkingDraftOnCampaignObject,
  getMediaPlanLifecycle,
  getMediaPlanWorkingStatus,
} from "./media-plan-mutations";
import { getOutputDefinition } from "./output-catalog";
import {
  computeInputFingerprints,
  computeSourceFingerprint,
} from "./output-fingerprint";
import {
  generateCampaignOutput,
  getCampaignOutputState,
  type GenerateCampaignOutputResult,
} from "./output-registry";
import type {
  CampaignOutputInputKey,
  CampaignOutputOrigin,
  CampaignOutputRecord,
  MediaPlanApprovalImpact,
} from "./output-types";

export type ReviseMediaPlanOptions = {
  now?: string;
  origin?: CampaignOutputOrigin;
  actorUserId?: string;
  /** Short audit reason. */
  changeReason?: string;
  /** Human change summary for history / audit. */
  changeSummary?: string;
  changedInputs?: CampaignOutputInputKey[];
  approvalImpact?: MediaPlanApprovalImpact;
  /**
   * Compact before/after for audit. Optional — callers should supply when practical.
   */
  before?: unknown;
  after?: unknown;
  operationClass?: string;
};

/**
 * Apply a controlled Media Plan content patch.
 *
 * - Working tip (Draft / Under Review): same business version + audit entry.
 * - Approved tip: forks a working draft and opens a new minor business version, then patches.
 */
export function reviseMediaPlanOutput(
  campaignObject: CampaignObject,
  data: MediaPlanData,
  options?: ReviseMediaPlanOptions
): GenerateCampaignOutputResult | null {
  const definition = getOutputDefinition("media_plan");
  if (!definition) return null;

  let nextObject = campaignObject;
  let forkedFromApproved = false;
  const engineStatus = getMediaPlanWorkingStatus(nextObject);

  if (isApprovedStatus(engineStatus)) {
    const forked = ensureWorkingDraftOnCampaignObject(nextObject, {
      at: options?.now,
      actorUserId: options?.actorUserId,
      label: "Revision from approved Media Plan",
      businessOperation: "revise",
      approvalImpact: options?.approvalImpact ?? "internal",
      origin: options?.origin,
      changeReason: options?.changeReason,
      changeSummary: options?.changeSummary,
    });
    if (!forked.ok) return null;
    nextObject = forked.campaignObject;
    forkedFromApproved = forked.forkedDraft;
  }

  const state = getCampaignOutputState(nextObject);
  const previous = state.media_plan;
  if (!previous) return null;

  // Hard constraint: rebalance into Campaign Start–End, then reject if still invalid.
  const windowSafeData = enforceMediaPlanCampaignWindow(data);

  const now = options?.now ?? new Date().toISOString();
  const origin = options?.origin ?? previous.origin ?? "copilot";
  const content = mediaPlanContentFromData(windowSafeData, previous.content);
  const fingerprint = computeSourceFingerprint(nextObject, definition.inputKeys);
  const inputFingerprints = computeInputFingerprints(nextObject, definition.inputKeys);
  const tipStatus = getMediaPlanWorkingStatus(nextObject);

  const createBusinessVersion = shouldCreateNewBusinessVersion({
    engineStatus: tipStatus,
    forkedFromApproved,
    operation: "revise",
  });

  // Fork path already bumped via ensureWorkingDraft — do not bump again.
  let record: CampaignOutputRecord = previous;
  if (createBusinessVersion && !forkedFromApproved) {
    record = beginMediaPlanBusinessVersion(previous, {
      operation: "revise",
      now,
      origin,
      actorUserId: options?.actorUserId,
      changeReason: options?.changeReason,
      changeSummary: options?.changeSummary,
      approvalImpact: options?.approvalImpact ?? defaultApprovalImpactForOperation("revise"),
    });
  }

  const changeReason =
    options?.changeReason ?? "Media Plan working edit (controlled update).";
  const changeSummary =
    options?.changeSummary ??
    (createBusinessVersion || forkedFromApproved
      ? `Revised Media Plan to ${record.versionLabel} — creators, waves, deliverables, and publishing order preserved.`
      : `Updated Media Plan ${record.versionLabel ?? "v1.0"} (same business version; audit recorded).`);

  let sizeBytes = 0;
  try {
    sizeBytes = JSON.stringify(content).length;
  } catch {
    sizeBytes = previous.sizeBytes ?? 0;
  }

  const auditHistory = appendMediaPlanAuditEntry(record, {
    at: now,
    actorKind: actorKindFromOrigin(origin),
    actorUserId: options?.actorUserId,
    reason: changeReason,
    before: options?.before,
    after: options?.after ?? {
      durationWeeks: windowSafeData.durationWeeks,
      campaignEndDate: windowSafeData.campaignEndDate,
    },
    operationClass: options?.operationClass ?? "revise_patch",
  });

  const beforeContent = previous.content;
  record = syncMediaPlanBusinessStatusFromEngine(
    {
      ...record,
      kind: "media_plan",
      status: "generated",
      updatedAt: now,
      sourceFingerprint: fingerprint,
      inputFingerprints,
      generatorVersion: previous.generatorVersion ?? definition.generatorVersion,
      origin,
      actorKind: actorKindFromOrigin(origin),
      actorUserId: options?.actorUserId,
      sizeBytes,
      changeReason,
      changeSummary,
      changedInputs: options?.changedInputs ?? ["timeline"],
      content,
      auditHistory,
      editHistory: record.editHistory ?? previous.editHistory,
      businessStatus: record.businessStatus ?? "draft",
      approvalImpact:
        record.approvalImpact ??
        (createBusinessVersion || forkedFromApproved
          ? options?.approvalImpact ?? "internal"
          : record.approvalImpact ?? "none"),
    },
    tipStatus
  );

  const editEntry = buildMediaPlanEditHistoryEntry({
    record,
    beforeContent,
    afterContent: content,
    actorKind: actorKindFromOrigin(origin),
    actorUserId: options?.actorUserId,
    operationClass: options?.operationClass ?? "revise_patch",
    at: now,
  });
  record = withMediaPlanEditHistoryAppend(record, editEntry);

  return {
    campaignObject: {
      ...nextObject,
      updatedAt: now,
      meta: {
        ...nextObject.meta,
        campaignOutputs: { ...state, media_plan: record },
      },
    },
    record,
  };
}

/**
 * Regenerate the Media Plan strategically.
 *
 * - Pre-approval working tip: replaces content on the same business version + audit.
 * - Approved tip: forks + opens a new major business version, then regenerates.
 */
export function regenerateMediaPlanOutput(
  campaignObject: CampaignObject,
  options?: {
    now?: string;
    origin?: CampaignOutputOrigin;
    actorUserId?: string;
    changeSummary?: string;
    campaignVersion?: number;
  }
): GenerateCampaignOutputResult {
  return generateCampaignOutput(campaignObject, "media_plan", {
    now: options?.now,
    origin: options?.origin ?? "copilot",
    actorUserId: options?.actorUserId,
    campaignVersion: options?.campaignVersion,
    operation: "regenerate",
    changeSummary:
      options?.changeSummary ??
      "Regenerated Media Plan — strategic redesign (creators/waves/schedule may change).",
  });
}

/** Read structured Media Plan data from the current output record. */
export function readMediaPlanData(
  campaignObject: CampaignObject
): MediaPlanData | null {
  return asMediaPlanData(
    getCampaignOutputState(campaignObject).media_plan?.content?.data
  );
}

/** Expose lifecycle helper for tests / callers that need approval boundary checks. */
export function mediaPlanHasApprovedBaseline(campaignObject: CampaignObject): boolean {
  return getMediaPlanLifecycle(campaignObject).currentApprovedBaselineVersion != null;
}
