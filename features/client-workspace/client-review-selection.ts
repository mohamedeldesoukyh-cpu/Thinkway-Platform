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

export type CampaignClientWorkspaceLinkState = "active" | "off" | "none";

export type CampaignClientWorkspaceLink = {
  state: CampaignClientWorkspaceLinkState;
  reviewNumber?: number;
};

export const CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL: Record<
  CampaignClientWorkspaceLinkState,
  string
> = {
  active: "Active",
  off: "Off",
  none: "None",
};

/** Portfolio list: Active unless the latest review is revoked with no remaining journey token. */
export function campaignClientWorkspaceLinkFromLatest(input: {
  latestStatus?: string | null;
  reviewNumber?: number | null;
  journeyHasShareToken?: boolean;
}): CampaignClientWorkspaceLink {
  const status = input.latestStatus?.trim() || null;
  const reviewNumber =
    typeof input.reviewNumber === "number" && Number.isFinite(input.reviewNumber)
      ? input.reviewNumber
      : undefined;
  const withNumber = (
    state: CampaignClientWorkspaceLinkState
  ): CampaignClientWorkspaceLink =>
    reviewNumber != null ? { state, reviewNumber } : { state };

  if (clientReviewSharePeekExists(status) || input.journeyHasShareToken) {
    return withNumber("active");
  }
  if (status === "revoked") {
    return withNumber("off");
  }
  return { state: "none" };
}

export function latestCampaignClientReviewByHeader(
  rows: ReadonlyArray<{
    campaign_header_id: string;
    status: string;
    review_number: number;
  }>
): Map<string, { status: string; review_number: number }> {
  const latest = new Map<string, { status: string; review_number: number }>();
  for (const row of rows) {
    const current = latest.get(row.campaign_header_id);
    if (!current || row.review_number > current.review_number) {
      latest.set(row.campaign_header_id, {
        status: row.status,
        review_number: row.review_number,
      });
    }
  }
  return latest;
}

export function campaignHeaderIdsWithShareToken(
  rows: ReadonlyArray<{
    campaign_header_id?: string | null;
    share_token?: string | null;
  }>
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    const headerId = row.campaign_header_id?.trim();
    if (headerId && row.share_token?.trim()) ids.add(headerId);
  }
  return ids;
}

/** Reviews that must be revoked so the campaign list Client link becomes Off. */
export function campaignClientReviewIdsToStop(
  rows: ReadonlyArray<{
    id: string;
    status: string;
    review_number: number;
  }>
): string[] {
  const ids = new Set<string>();
  let latest: { id: string; status: string; review_number: number } | undefined;
  for (const row of rows) {
    if (!latest || row.review_number > latest.review_number) latest = row;
    if (row.status === "awaiting_review" || row.status === "changes_requested") {
      ids.add(row.id);
    }
  }
  if (latest && clientReviewSharePeekExists(latest.status)) ids.add(latest.id);
  return [...ids];
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
