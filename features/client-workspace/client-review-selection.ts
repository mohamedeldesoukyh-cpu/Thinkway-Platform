import type { ClientCreatorSelectionState } from "./constants";

export function quotationIsMovedToCampaign(detail: {
  campaign_header_id?: string | null;
  status: string;
}): boolean {
  return Boolean(detail.campaign_header_id) || detail.status === "accepted";
}

export function defaultQuotationClientSelection(
  creatorIds: readonly string[],
  movedToCampaign: boolean
): Record<string, ClientCreatorSelectionState> {
  const state: ClientCreatorSelectionState = movedToCampaign ? "accepted" : "in_review";
  return Object.fromEntries(creatorIds.map((id) => [id, state]));
}

/** Reveal an existing link, or a campaign-linked quotation, from saved DB — do not block on a dirty UI. */
export function quotationClientShareRequiresSave(input: {
  hasUnsavedChanges: boolean;
  hasExistingLink: boolean;
  movedToCampaign: boolean;
}): boolean {
  if (!input.hasUnsavedChanges) return false;
  if (input.hasExistingLink || input.movedToCampaign) return false;
  return true;
}

export function mergePersistedClientSelection(input: {
  creatorIds: readonly string[];
  previous?: Record<string, ClientCreatorSelectionState> | null;
  incoming: Record<string, ClientCreatorSelectionState>;
  replaceSelection?: boolean;
}): Record<string, ClientCreatorSelectionState> {
  const next: Record<string, ClientCreatorSelectionState> = {};
  for (const id of input.creatorIds) {
    if (input.replaceSelection) {
      next[id] = input.incoming[id] ?? "in_review";
      continue;
    }
    next[id] = input.previous?.[id] ?? input.incoming[id] ?? "in_review";
  }
  return next;
}

export function clientSelectionsEqual(
  a: Record<string, ClientCreatorSelectionState> | null | undefined,
  b: Record<string, ClientCreatorSelectionState> | null | undefined,
  creatorIds: readonly string[]
): boolean {
  return creatorIds.every((id) => (a?.[id] ?? "in_review") === (b?.[id] ?? "in_review"));
}
