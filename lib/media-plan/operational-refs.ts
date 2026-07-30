/**
 * Release 2.1 — Assignment-centric operational references for Media Plan.
 *
 * Assignment (`campaign_lines.id`) is the authoritative operational join.
 * Deliverable / Post IDs are optional finer grain. Creator labels are display-only.
 */

export type MediaPlanOperationalRefs = {
  /** Assignment PK — `campaign_lines.id`. Authoritative join key. */
  campaignLineId?: string | null;
  /** Optional — `assignment_deliverables.id`. */
  assignmentDeliverableId?: string | null;
  /** Optional — `assignment_post_schedule.id`. */
  assignmentPostScheduleId?: string | null;
};

export type OperationalMatchMode =
  | "assignment_post"
  | "assignment_deliverable"
  | "assignment"
  | "legacy_label";

export type OperationalMatchKey = {
  key: string;
  mode: OperationalMatchMode;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normLabel(value: string | null | undefined): string {
  return norm(value).replace(/\s+/g, " ");
}

/**
 * Build the authoritative match key for Planned ↔ Actual / Remaining.
 * Prefer Post → Deliverable → Assignment; legacy creator/label only when no Assignment ID.
 */
export function operationalMatchKey(
  refs: MediaPlanOperationalRefs & {
    creatorId?: string | null;
    platform?: string | null;
    deliverable?: string | null;
  }
): OperationalMatchKey {
  const postId = refs.assignmentPostScheduleId?.trim();
  if (postId) {
    return { key: `post:${norm(postId)}`, mode: "assignment_post" };
  }

  const deliverableId = refs.assignmentDeliverableId?.trim();
  if (deliverableId) {
    return { key: `deliverable:${norm(deliverableId)}`, mode: "assignment_deliverable" };
  }

  const lineId = refs.campaignLineId?.trim();
  if (lineId) {
    // Disambiguate multiple planned slots on one Assignment by display grain.
    return {
      key: [
        `line:${norm(lineId)}`,
        norm(refs.platform),
        normLabel(refs.deliverable),
      ].join("::"),
      mode: "assignment",
    };
  }

  return {
    key: [
      norm(refs.creatorId),
      norm(refs.platform),
      normLabel(refs.deliverable),
    ].join("::"),
    mode: "legacy_label",
  };
}

/** True when the match used Assignment (or child) identity rather than labels. */
export function isAssignmentBackedMatch(mode: OperationalMatchMode): boolean {
  return mode !== "legacy_label";
}

export function pickOperationalRefs<T extends MediaPlanOperationalRefs>(
  source: T
): MediaPlanOperationalRefs {
  return {
    campaignLineId: source.campaignLineId?.trim() || null,
    assignmentDeliverableId: source.assignmentDeliverableId?.trim() || null,
    assignmentPostScheduleId: source.assignmentPostScheduleId?.trim() || null,
  };
}
