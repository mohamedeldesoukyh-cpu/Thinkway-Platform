import type { ClientCreatorSelectionState, ClientReviewStatus } from "./constants";
import { CLIENT_STATUS_LABEL } from "./constants";

export function isInteractiveClientReview(status: ClientReviewStatus): boolean {
  return status === "awaiting_review" || status === "changes_requested";
}

export function isFrozenClientReviewStatus(status: ClientReviewStatus): boolean {
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "superseded" ||
    status === "revoked"
  );
}

export function isReusableClientReviewTip(
  status: ClientReviewStatus,
  reuseInteractiveReview?: boolean
): boolean {
  return Boolean(reuseInteractiveReview) && isInteractiveClientReview(status);
}

export function clientStatusLabel(status: ClientReviewStatus): string {
  return CLIENT_STATUS_LABEL[status];
}

export function actionRequiredFor(status: ClientReviewStatus, hasNewerVersion: boolean): string {
  if (hasNewerVersion || status === "superseded") return "Review the new version";
  if (status === "awaiting_review") return "Review campaign";
  if (status === "changes_requested") return "Waiting for Thinkway to update the package";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "This review link is no longer active";
}

export function countSelections(
  selection: Record<string, ClientCreatorSelectionState>,
  creatorIds: string[]
): { accepted: number; rejected: number; inReview: number; total: number } {
  let accepted = 0;
  let rejected = 0;
  let inReview = 0;
  for (const id of creatorIds) {
    const state = selection[id] ?? "in_review";
    if (state === "accepted") accepted += 1;
    else if (state === "rejected") rejected += 1;
    else inReview += 1;
  }
  return { accepted, rejected, inReview, total: creatorIds.length };
}

export function shortlistStatusToClient(
  itemStatus: string | null | undefined
): ClientCreatorSelectionState {
  if (itemStatus === "approved" || itemStatus === "moved_to_campaign") return "accepted";
  if (itemStatus === "rejected" || itemStatus === "cancelled") return "rejected";
  return "in_review";
}

export function clientSelectionToShortlistStatus(
  state: ClientCreatorSelectionState
): "under_review" | "approved" | "rejected" {
  if (state === "accepted") return "approved";
  if (state === "rejected") return "rejected";
  return "under_review";
}

/** Accept can be removed until the client submits Approve Shortlist or Approve Quotation. */
export function nextAcceptState(state?: ClientCreatorSelectionState): ClientCreatorSelectionState {
  return state === "accepted" ? "in_review" : "accepted";
}

/** Calculator and approval use explicit Accept — In Review is not counted. */
export function isSelectedForCalculator(state?: ClientCreatorSelectionState): boolean {
  return state === "accepted";
}
