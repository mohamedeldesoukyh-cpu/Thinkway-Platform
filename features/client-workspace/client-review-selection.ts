import { quotationIsConvertedToCampaign } from "@/lib/commercial/quotation-validity";

import type { ClientCreatorSelectionState } from "./constants";

export function quotationIsMovedToCampaign(detail: {
  campaign_header_id?: string | null;
  status: string;
}): boolean {
  return quotationIsConvertedToCampaign({
    campaignHeaderId: detail.campaign_header_id,
    status: detail.status,
  });
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

/** A Client Workspace share still exists unless the latest review was revoked. */
export function clientReviewSharePeekExists(status?: string | null): boolean {
  return Boolean(status && status !== "revoked");
}

/** Keep Show link if peek or this-record cache already knows a share exists. */
export function clientReviewShareHasLink(peekExists: boolean, cachedShare: boolean): boolean {
  return peekExists || cachedShare;
}

export function collectQuotationFamilyIds(input: {
  quotationId: string;
  parentQuotationId?: string | null;
  familyIds?: Array<string | null | undefined>;
}): string[] {
  const ids = new Set<string>();
  const add = (value?: string | null) => {
    const id = value?.trim();
    if (id) ids.add(id);
  };
  add(input.quotationId);
  add(input.parentQuotationId?.trim() || input.quotationId);
  for (const id of input.familyIds ?? []) add(id);
  return [...ids];
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
