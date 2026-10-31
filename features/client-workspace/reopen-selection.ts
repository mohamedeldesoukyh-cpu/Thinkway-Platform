import type { ClientReviewSourceSnapshot } from "./types";

export function reopenSelectionAllowed(input: {
  interactive: boolean;
  historical: boolean;
  commerciallyApproved: boolean;
  inCampaign: boolean;
}): boolean {
  return input.interactive && !input.historical && !input.commerciallyApproved && !input.inCampaign;
}

/** Reconfirmation is required after editing; preserve all creator choices and prices. */
export function withoutSelectionConfirmation(snapshot: ClientReviewSourceSnapshot): ClientReviewSourceSnapshot {
  const next = { ...snapshot };
  delete next.clientSelection;
  next.selectionReopenedAt = new Date().toISOString();
  return next;
}

/** An explicit reopen must not inherit a previous shortlist's confirmation. */
export function selectionConfirmationFromSnapshots(...snapshots: Array<ClientReviewSourceSnapshot | null | undefined>) {
  for (const snapshot of snapshots) {
    if (snapshot?.clientSelection) return snapshot.clientSelection;
    if (snapshot?.selectionReopenedAt) return undefined;
  }
  return undefined;
}
