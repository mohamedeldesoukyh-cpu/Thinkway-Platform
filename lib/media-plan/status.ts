import type { MediaPlanStatus } from "./types";

const APPROVED_STATUSES: ReadonlySet<MediaPlanStatus> = new Set([
  "approved_by_client",
  "approved_on_behalf",
]);

const IMMUTABLE_STATUSES: ReadonlySet<MediaPlanStatus> = new Set([
  "locked",
  "approved_by_client",
  "approved_on_behalf",
  "pending_approval",
]);

export function isApprovedStatus(status: MediaPlanStatus): boolean {
  return APPROVED_STATUSES.has(status);
}

/** Versions that must never be mutated or regenerated in place. */
export function isImmutableStatus(status: MediaPlanStatus): boolean {
  return IMMUTABLE_STATUSES.has(status);
}

export function isEditableDraftStatus(status: MediaPlanStatus): boolean {
  return status === "draft";
}

export function mediaPlanStatusLabel(status: MediaPlanStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "locked":
      return "Locked";
    case "approved_by_client":
      return "Approved by Client";
    case "approved_on_behalf":
      return "Approved on Behalf of Client";
    case "pending_approval":
      return "Pending Approval";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
