import type { ShortlistStatus } from "@/types/database";

/**
 * Allowed shortlist status transitions (spec §3, §13). Mirrors the DB trigger
 * `enforce_discovery_shortlist_transition` so the UI/actions can fail fast with a
 * friendly message before hitting the database guard.
 *
 *   draft         → under_review | cancelled | archived
 *   under_review  → approved | draft | cancelled | archived
 *   approved      → cancelled | archived
 *   cancelled     → draft (reopen)
 *   archived      → (terminal, soft-deleted)
 */
export const SHORTLIST_STATUS_TRANSITIONS: Record<
  ShortlistStatus,
  ShortlistStatus[]
> = {
  draft: ["under_review", "cancelled", "archived"],
  under_review: ["approved", "draft", "cancelled", "archived"],
  approved: ["cancelled", "archived"],
  cancelled: ["draft"],
  archived: [],
};

export function canTransition(
  from: ShortlistStatus,
  to: ShortlistStatus
): boolean {
  if (from === to) return true;
  return SHORTLIST_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: ShortlistStatus,
  to: ShortlistStatus
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid shortlist status transition: ${from} → ${to}.`
    );
  }
}

/** Creators can only be moved/edited when the list is an active working state. */
export function canEditCreators(status: ShortlistStatus): boolean {
  return status === "draft" || status === "under_review";
}

/** Move To Campaign is only allowed from an Approved shortlist (spec §5, §7). */
export function canMoveToCampaign(status: ShortlistStatus): boolean {
  return status === "approved";
}

/** Cancelled lists keep their data but block creator movement (spec §13). */
export function isMovementLocked(status: ShortlistStatus): boolean {
  return status === "cancelled" || status === "archived";
}
