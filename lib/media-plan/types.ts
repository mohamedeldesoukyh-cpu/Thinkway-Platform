/**
 * Media Plan Engine domain types.
 *
 * Persistence mapping (Phase 1+): versions live with the Campaign Object /
 * campaign_object_versions; this module owns the business rules only.
 */

/** PRD approval / planning statuses for a Media Plan version tip. */
export type MediaPlanStatus =
  | "draft"
  | "locked"
  | "approved_by_client"
  | "approved_on_behalf"
  | "pending_approval";

export type MediaPlanApprovalMethod =
  | "client_portal"
  | "on_behalf"
  | null;

export type MediaPlanApprovalSource =
  | "email"
  | "whatsapp"
  | "phone"
  | "meeting"
  | "other"
  | null;

export type MediaPlanViewKind = "original" | "actual" | "remaining";

export type MediaPlanItemStatus = "planned" | "completed" | "remaining";

/** One scheduled (or unscheduled) deliverable slot on a Media Plan version. */
export type MediaPlanItem = {
  id: string;
  creatorId: string;
  creatorName: string;
  platform: string;
  deliverable: string;
  /** ISO date (YYYY-MM-DD) when planned; null = unallocated. */
  plannedDate: string | null;
  /** ISO date from Performance live date when known. */
  actualLiveDate: string | null;
  status: MediaPlanItemStatus;
  /** Assignment PK — authoritative operational join (Release 2.1). */
  campaignLineId?: string | null;
  assignmentDeliverableId?: string | null;
  assignmentPostScheduleId?: string | null;
  /** True when Planned↔Actual used legacy creator/label match (pre-2.1 plans). */
  usedLegacyMatch?: boolean;
};

export type MediaPlanVersionKind = "baseline" | "draft" | "archived_baseline";

export type MediaPlanVersionRecord = {
  version: number;
  kind: MediaPlanVersionKind;
  status: MediaPlanStatus;
  /** Deep snapshot of schedule items for this version. */
  items: MediaPlanItem[];
  createdAt: string;
  createdBy?: string | null;
  /** Present when this version was approved. */
  approvedAt?: string | null;
  approvalMethod?: MediaPlanApprovalMethod;
  approvalSource?: MediaPlanApprovalSource;
  approvedBy?: string | null;
  notes?: string | null;
  /** Human label for version history UI. */
  label?: string | null;
};

/**
 * Authoritative Media Plan state for one campaign.
 *
 * Invariants (enforced by versioning helpers):
 * - Exactly zero or one Current Approved Baseline (`currentApprovedBaselineVersion`).
 * - At most one Working Draft (`workingDraftVersion`).
 * - Approved baselines are never mutated in place.
 */
export type MediaPlanState = {
  /** Stable Media Plan id shared by Studio + Campaign (typically campaign_object id). */
  mediaPlanId: string;
  campaignId: string;
  /** Linked Studio / Campaign Object id — same plan, never duplicated. */
  campaignObjectId: string;
  source: "studio" | "campaign";
  currentApprovedBaselineVersion: number | null;
  workingDraftVersion: number | null;
  versions: MediaPlanVersionRecord[];
  lockedAt?: string | null;
  lockedBy?: string | null;
};

export type MediaPlanTimelineEventType =
  | "media_plan_created"
  | "draft_created"
  | "media_plan_regenerated"
  | "media_plan_locked"
  | "media_plan_unlocked"
  | "client_approved"
  | "approved_on_behalf"
  | "revision_created"
  | "baseline_published"
  | "changes_requested"
  | "rejected"
  | "schedule_edited"
  | "sync";

export type MediaPlanTimelineEvent = {
  type: MediaPlanTimelineEventType;
  mediaPlanId: string;
  campaignId: string;
  version: number | null;
  at: string;
  actorUserId?: string | null;
  summary: string;
  previousValue?: unknown;
  newValue?: unknown;
};

/** Performance row used to build Actual / Remaining projections. */
export type MediaPlanPerformanceFact = {
  creatorId: string;
  /** Display name when known (Actual-only rows use this when no baseline item). */
  creatorName?: string | null;
  platform: string;
  deliverable: string;
  /** ISO live date when published. */
  liveDate: string | null;
  completed: boolean;
  /** Assignment PK — authoritative operational join (Release 2.1). */
  campaignLineId?: string | null;
  assignmentDeliverableId?: string | null;
  assignmentPostScheduleId?: string | null;
  /** Grain locks — used by Media Plan mutation guards. */
  isLocked?: boolean;
  billingLocked?: boolean;
};

export type MediaPlanProjectionDay = {
  date: string;
  creators: Array<{
    creatorId: string;
    creatorName: string;
    deliverables: Array<{
      platform: string;
      deliverable: string;
      itemId: string;
    }>;
  }>;
};

export type MediaPlanDiffChangeType =
  | "date_changed"
  | "creator_changed"
  | "deliverable_changed"
  | "platform_changed"
  | "item_added"
  | "item_removed";

export type MediaPlanDiffEntry = {
  changeType: MediaPlanDiffChangeType;
  itemId?: string;
  before?: Partial<MediaPlanItem> | null;
  after?: Partial<MediaPlanItem> | null;
};

export type EnsureWorkingDraftResult =
  | {
      ok: true;
      state: MediaPlanState;
      draftVersion: number;
      created: boolean;
      events: MediaPlanTimelineEvent[];
    }
  | { ok: false; error: string };

export type PromoteDraftResult =
  | {
      ok: true;
      state: MediaPlanState;
      baselineVersion: number;
      events: MediaPlanTimelineEvent[];
    }
  | { ok: false; error: string };

export type RegenerateUiState = {
  visible: true;
  enabled: boolean;
  message: string | null;
};

export type PrepareRegenerateResult =
  | {
      ok: true;
      state: MediaPlanState;
      draftVersion: number;
      /** True when regenerate may run against the working draft now. */
      canRegenerateNow: boolean;
      createdDraft: boolean;
      events: MediaPlanTimelineEvent[];
      message: string | null;
    }
  | { ok: false; error: string };
