import type { ShortlistItemStatus } from "@/types/database";

/**
 * Per-creator item status transitions within a shortlist.
 * Independent of shortlist header status — bulk ops affect selected items only.
 */
export const SHORTLIST_ITEM_STATUS_TRANSITIONS: Record<
  ShortlistItemStatus,
  ShortlistItemStatus[]
> = {
  draft: ["under_review", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: ["moved_to_campaign", "cancelled"],
  rejected: ["draft"],
  moved_to_campaign: [],
  cancelled: ["draft"],
};

export function canTransitionItem(
  from: ShortlistItemStatus,
  to: ShortlistItemStatus
): boolean {
  if (from === to) return true;
  return SHORTLIST_ITEM_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertItemTransition(
  from: ShortlistItemStatus,
  to: ShortlistItemStatus
): void {
  if (!canTransitionItem(from, to)) {
    throw new Error(`Invalid creator status transition: ${from} → ${to}.`);
  }
}

/** Creators can be removed while the shortlist allows edits and item is not terminal. */
export function canRemoveItem(status: ShortlistItemStatus): boolean {
  return status === "draft" || status === "under_review" || status === "rejected";
}

export function canSubmitItemForReview(status: ShortlistItemStatus): boolean {
  return status === "draft";
}

export function canBulkApproveItem(status: ShortlistItemStatus): boolean {
  return status === "under_review";
}

export function canBulkRejectItem(status: ShortlistItemStatus): boolean {
  return status === "under_review";
}

export function canBulkCancelItem(status: ShortlistItemStatus): boolean {
  return status === "draft" || status === "under_review" || status === "approved";
}

export function canMoveItemToCampaign(status: ShortlistItemStatus): boolean {
  return status === "approved";
}

/** Terminal states — excluded from select-all bulk submit. */
export function isTerminalItemStatus(status: ShortlistItemStatus): boolean {
  return status === "moved_to_campaign" || status === "cancelled";
}
