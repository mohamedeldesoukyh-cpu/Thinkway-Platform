/**
 * Media Plan business versioning — SSOT: docs/architecture/MEDIA_PLAN_VERSIONING.md
 *
 * Contract:
 * - Specification takes precedence over code deviations.
 * - Business Version ≠ Audit History (completely separate).
 * - Approval is the version boundary — not every edit.
 * - Approved versions are immutable; only revise / regenerate / restore as new versions.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  isApprovedStatus,
  type MediaPlanStatus,
} from "@/lib/media-plan";

import type {
  CampaignOutputActorKind,
  CampaignOutputOperation,
  CampaignOutputOrigin,
  CampaignOutputRecord,
  CampaignOutputVersionSnapshot,
  MediaPlanApprovalImpact,
  MediaPlanApprovalSource,
  MediaPlanAuditEntry,
  MediaPlanBusinessStatus,
} from "./output-types";

const MAX_AUDIT_HISTORY = 100;

export type MediaPlanVersionParts = {
  major: number;
  minor: number;
};

export function formatMediaPlanVersionLabel(major: number, minor: number): string {
  return `v${major}.${minor}`;
}

/** Map engine lifecycle status → SSOT business status. */
export function toBusinessStatus(engineStatus: MediaPlanStatus): MediaPlanBusinessStatus {
  switch (engineStatus) {
    case "draft":
      return "draft";
    case "locked":
    case "pending_approval":
      return "under_review";
    case "approved_by_client":
    case "approved_on_behalf":
      return "approved";
    default: {
      const _exhaustive: never = engineStatus;
      return _exhaustive;
    }
  }
}

export function businessStatusLabel(status: MediaPlanBusinessStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "under_review":
      return "Under Review";
    case "approved":
      return "Approved";
    case "superseded":
      return "Superseded";
    case "archived":
      return "Archived";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Pre-approval working tip: Draft or Under Review.
 * Edits must NOT create a new business version.
 */
export function isWorkingBusinessVersion(
  status: MediaPlanBusinessStatus | MediaPlanStatus
): boolean {
  if (status === "draft" || status === "under_review" || status === "locked" || status === "pending_approval") {
    return true;
  }
  return false;
}

export function isApprovedBusinessVersion(
  status: MediaPlanBusinessStatus | MediaPlanStatus
): boolean {
  if (status === "approved" || status === "approved_by_client" || status === "approved_on_behalf") {
    return true;
  }
  return isApprovedStatus(status as MediaPlanStatus);
}

/** Resolve major/minor from a record, migrating legacy integer-only versions. */
export function resolveMediaPlanVersionParts(
  record?: Pick<CampaignOutputRecord, "version" | "versionMajor" | "versionMinor"> | null
): MediaPlanVersionParts {
  if (record?.versionMajor != null && Number.isFinite(record.versionMajor)) {
    return {
      major: Math.max(1, Math.floor(record.versionMajor)),
      minor: Math.max(0, Math.floor(record.versionMinor ?? 0)),
    };
  }
  const legacy = record?.version ?? 0;
  if (legacy <= 0) return { major: 0, minor: 0 };
  // Pre-scheme integers were full rebuilds — treat as major line, minor 0.
  return { major: legacy, minor: 0 };
}

/**
 * Compute the next business version numbers.
 * Call only at business-version boundaries (initial, leave Approved, restore).
 */
export function nextMediaPlanVersion(
  previous: Pick<CampaignOutputRecord, "version" | "versionMajor" | "versionMinor"> | null | undefined,
  operation: CampaignOutputOperation
): MediaPlanVersionParts & { version: number; versionLabel: string } {
  const parts = resolveMediaPlanVersionParts(previous);
  const nextSequence = (previous?.version ?? 0) + 1;

  let major = parts.major;
  let minor = parts.minor;

  if (operation === "initial" || !previous || previous.version <= 0) {
    major = 1;
    minor = 0;
  } else if (operation === "regenerate") {
    major = Math.max(1, parts.major) + 1;
    minor = 0;
  } else {
    // revise | restore — minor bump on current major line
    major = Math.max(1, parts.major);
    minor = parts.minor + 1;
  }

  return {
    version: nextSequence,
    major,
    minor,
    versionLabel: formatMediaPlanVersionLabel(major, minor),
  };
}

export function actorKindFromOrigin(
  origin?: CampaignOutputOrigin
): CampaignOutputActorKind {
  if (origin === "user") return "user";
  if (origin === "automatic") return "system";
  return "ai";
}

export function defaultApprovalImpactForOperation(
  operation: CampaignOutputOperation
): MediaPlanApprovalImpact {
  if (operation === "initial") return "none";
  if (operation === "regenerate") return "client_reapproval";
  if (operation === "restore") return "client_reapproval";
  // revise — default internal; callers may override for creator/mix changes
  return "internal";
}

export function versionFieldsForSnapshot(
  record: CampaignOutputRecord
): Pick<
  CampaignOutputVersionSnapshot,
  | "versionMajor"
  | "versionMinor"
  | "versionLabel"
  | "operation"
  | "changeSummary"
  | "actorKind"
  | "actorUserId"
  | "businessStatus"
  | "approvedBy"
  | "approvedAt"
  | "approvalSource"
  | "approvalImpact"
> {
  const parts = resolveMediaPlanVersionParts(record);
  return {
    versionMajor: record.versionMajor ?? parts.major,
    versionMinor: record.versionMinor ?? parts.minor,
    versionLabel:
      record.versionLabel ?? formatMediaPlanVersionLabel(parts.major, parts.minor),
    operation: record.operation,
    changeSummary: record.changeSummary,
    actorKind: record.actorKind,
    actorUserId: record.actorUserId,
    businessStatus: record.businessStatus,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    approvalSource: record.approvalSource,
    approvalImpact: record.approvalImpact,
  };
}

export function appendMediaPlanAuditEntry(
  record: CampaignOutputRecord,
  entry: MediaPlanAuditEntry
): MediaPlanAuditEntry[] {
  return [...(record.auditHistory ?? []), entry].slice(-MAX_AUDIT_HISTORY);
}

/**
 * Whether a content write should create a new business version.
 * SSOT: only when leaving Approved (or restore / initial). Working tip = no.
 */
export function shouldCreateNewBusinessVersion(input: {
  engineStatus: MediaPlanStatus;
  /** True when ensureWorkingDraft just forked from an approved baseline. */
  forkedFromApproved?: boolean;
  operation: CampaignOutputOperation;
}): boolean {
  if (input.operation === "initial") return true;
  if (input.operation === "restore") return true;
  if (input.forkedFromApproved) return true;
  if (isApprovedBusinessVersion(input.engineStatus)) return true;
  // Draft / Under Review — audit only
  return false;
}

export type BeginBusinessVersionOptions = {
  operation: "revise" | "regenerate" | "restore";
  now?: string;
  origin?: CampaignOutputOrigin;
  actorUserId?: string;
  changeReason?: string;
  changeSummary?: string;
  approvalImpact?: MediaPlanApprovalImpact;
};

/**
 * Open a new business version from the current tip (push tip → history, bump label).
 * Used when forking off an Approved plan or restoring.
 */
export function beginMediaPlanBusinessVersion(
  record: CampaignOutputRecord,
  options: BeginBusinessVersionOptions
): CampaignOutputRecord {
  const now = options.now ?? new Date().toISOString();
  const origin = options.origin ?? record.origin ?? "copilot";
  const versionNext = nextMediaPlanVersion(record, options.operation);
  const approvalImpact =
    options.approvalImpact ?? defaultApprovalImpactForOperation(options.operation);

  const history: CampaignOutputVersionSnapshot[] = [
    ...(record.history ?? []),
    {
      version: record.version,
      ...versionFieldsForSnapshot(record),
      generatedAt: record.generatedAt,
      updatedAt: record.updatedAt,
      sourceFingerprint: record.sourceFingerprint,
      generatorVersion: record.generatorVersion,
      changeReason: record.changeReason,
      changedInputs: record.changedInputs,
      origin: record.origin,
      content: record.content,
    },
  ].slice(-12);

  return {
    ...record,
    version: versionNext.version,
    versionMajor: versionNext.major,
    versionMinor: versionNext.minor,
    versionLabel: versionNext.versionLabel,
    operation: options.operation,
    updatedAt: now,
    origin,
    actorKind: actorKindFromOrigin(origin),
    actorUserId: options.actorUserId,
    changeReason: options.changeReason ?? `Opened ${versionNext.versionLabel}.`,
    changeSummary:
      options.changeSummary ??
      (options.operation === "regenerate"
        ? `Regenerated Media Plan ${versionNext.versionLabel} (new strategic version).`
        : options.operation === "restore"
          ? `Restored prior Media Plan as ${versionNext.versionLabel}.`
          : `Revised Media Plan ${versionNext.versionLabel}.`),
    businessStatus: "draft",
    approvedBy: null,
    approvedAt: null,
    approvalSource: null,
    approvalImpact,
    history,
  };
}

/**
 * Stamp approval governance fields on the current business version tip.
 * Does not change the version label — approval freezes the current version.
 */
export function stampMediaPlanApproval(
  record: CampaignOutputRecord,
  input: {
    at: string;
    approvedBy?: string | null;
    approvalSource: MediaPlanApprovalSource;
  }
): CampaignOutputRecord {
  const history = (record.history ?? []).map((snap) =>
    snap.businessStatus === "approved"
      ? { ...snap, businessStatus: "superseded" as const }
      : snap
  );

  return {
    ...record,
    businessStatus: "approved",
    approvedBy: input.approvedBy ?? null,
    approvedAt: input.at,
    approvalSource: input.approvalSource,
    updatedAt: input.at,
    history,
    changeSummary:
      record.changeSummary ??
      `Media Plan ${record.versionLabel ?? formatMediaPlanVersionLabel(record.versionMajor ?? 1, record.versionMinor ?? 0)} approved.`,
  };
}

/** Sync businessStatus on the tip from engine lifecycle (Draft ↔ Under Review). */
export function syncMediaPlanBusinessStatusFromEngine(
  record: CampaignOutputRecord,
  engineStatus: MediaPlanStatus
): CampaignOutputRecord {
  if (record.businessStatus === "approved" && isApprovedBusinessVersion(engineStatus)) {
    return record;
  }
  if (isApprovedBusinessVersion(engineStatus)) {
    return { ...record, businessStatus: "approved" };
  }
  return { ...record, businessStatus: toBusinessStatus(engineStatus) };
}

export function getMediaPlanOutputRecord(
  campaignObject: CampaignObject
): CampaignOutputRecord | undefined {
  return campaignObject.meta.campaignOutputs?.media_plan;
}

export function withMediaPlanOutputRecord(
  campaignObject: CampaignObject,
  record: CampaignOutputRecord
): CampaignObject {
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      campaignOutputs: {
        ...campaignObject.meta.campaignOutputs,
        media_plan: record,
      },
    },
  };
}
