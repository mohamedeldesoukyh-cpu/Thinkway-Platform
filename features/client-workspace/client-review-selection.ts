import { quotationIsConvertedToCampaign } from "@/lib/commercial/quotation-validity";

import {
  CLIENT_REVIEW_STATUSES,
  type ClientCreatorSelectionState,
  type ClientReviewStatus,
} from "./constants";

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

/** Same Client Workspace share shown on Shortlist, Quotation, and Campaign lists. */
export type ClientWorkspaceListLink = CampaignClientWorkspaceLink;

export const CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL: Record<
  CampaignClientWorkspaceLinkState,
  string
> = {
  active: "Active",
  off: "Off",
  none: "None",
};

export const CLIENT_WORKSPACE_LIST_LINK_LABEL = CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL;

export type ClientWorkspaceListLinkSource = "campaign" | "quotation" | "shortlist";

export type ClientWorkspaceJourneyLinkRow = {
  id: string;
  share_token?: string | null;
  shortlist_id?: string | null;
  quotation_id?: string | null;
  campaign_header_id?: string | null;
};

export type ClientWorkspaceReviewLinkRow = {
  id: string;
  status: string;
  review_number: number;
  journey_id?: string | null;
  shortlist_id?: string | null;
  quotation_id?: string | null;
  campaign_header_id?: string | null;
};

export type ClientWorkspaceListLinkIndex = {
  byShortlistId: Map<string, ClientWorkspaceListLink>;
  byQuotationId: Map<string, ClientWorkspaceListLink>;
  byCampaignHeaderId: Map<string, ClientWorkspaceListLink>;
};

/**
 * Portfolio list: Off when the latest review is revoked, even if the journey
 * still holds the same share token so Stop → Activate can reuse the address.
 */
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

  if (status === "revoked") {
    return withNumber("off");
  }
  if (clientReviewSharePeekExists(status) || input.journeyHasShareToken) {
    return withNumber("active");
  }
  return { state: "none" };
}

/** Re-activate restores the status Stop recorded, never minting a new review. */
export function restoreStatusAfterClientLinkStop(
  previousStatus?: string | null
): ClientReviewStatus {
  const status = previousStatus?.trim() ?? "";
  if (
    status &&
    status !== "revoked" &&
    (CLIENT_REVIEW_STATUSES as readonly string[]).includes(status)
  ) {
    return status as ClientReviewStatus;
  }
  return "awaiting_review";
}

export function shouldRestoreStoppedCampaignClientReviews(
  rows: ReadonlyArray<{ status: string; review_number: number }>
): boolean {
  let latest: { status: string; review_number: number } | undefined;
  for (const row of rows) {
    if (!latest || row.review_number > latest.review_number) latest = row;
  }
  return latest?.status === "revoked";
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

function latestClientWorkspaceReview(
  rows: readonly ClientWorkspaceReviewLinkRow[]
): ClientWorkspaceReviewLinkRow | undefined {
  let latest: ClientWorkspaceReviewLinkRow | undefined;
  for (const row of rows) {
    if (!latest || row.review_number > latest.review_number) latest = row;
  }
  return latest;
}

function stampClientWorkspaceListLink(
  index: ClientWorkspaceListLinkIndex,
  keys: {
    shortlistId?: string | null;
    quotationId?: string | null;
    campaignHeaderId?: string | null;
    shortlist_id?: string | null;
    quotation_id?: string | null;
    campaign_header_id?: string | null;
  },
  link: ClientWorkspaceListLink
) {
  const shortlistId = (keys.shortlistId ?? keys.shortlist_id)?.trim();
  const quotationId = (keys.quotationId ?? keys.quotation_id)?.trim();
  const campaignHeaderId = (keys.campaignHeaderId ?? keys.campaign_header_id)?.trim();
  if (shortlistId) index.byShortlistId.set(shortlistId, link);
  if (quotationId) index.byQuotationId.set(quotationId, link);
  if (campaignHeaderId) index.byCampaignHeaderId.set(campaignHeaderId, link);
}

/**
 * One journey = one Client Workspace link. Shortlist, quotation, and campaign
 * rows that share that journey all show the same Active / Off / None state.
 */
export function indexClientWorkspaceListLinks(input: {
  journeys: readonly ClientWorkspaceJourneyLinkRow[];
  reviews: readonly ClientWorkspaceReviewLinkRow[];
}): ClientWorkspaceListLinkIndex {
  const index: ClientWorkspaceListLinkIndex = {
    byShortlistId: new Map(),
    byQuotationId: new Map(),
    byCampaignHeaderId: new Map(),
  };
  const reviewsByJourney = new Map<string, ClientWorkspaceReviewLinkRow[]>();
  const unscoped: ClientWorkspaceReviewLinkRow[] = [];
  for (const review of input.reviews) {
    const journeyId = review.journey_id?.trim();
    if (!journeyId) {
      unscoped.push(review);
      continue;
    }
    const list = reviewsByJourney.get(journeyId) ?? [];
    list.push(review);
    reviewsByJourney.set(journeyId, list);
  }

  const assignedReviewIds = new Set<string>();
  for (const journey of input.journeys) {
    const related: ClientWorkspaceReviewLinkRow[] = [...(reviewsByJourney.get(journey.id) ?? [])];
    for (const review of unscoped) {
      if (
        (journey.shortlist_id && review.shortlist_id === journey.shortlist_id) ||
        (journey.quotation_id && review.quotation_id === journey.quotation_id) ||
        (journey.campaign_header_id && review.campaign_header_id === journey.campaign_header_id)
      ) {
        related.push(review);
      }
    }
    const latest = latestClientWorkspaceReview(related);
    const link = campaignClientWorkspaceLinkFromLatest({
      latestStatus: latest?.status,
      reviewNumber: latest?.review_number,
      journeyHasShareToken: Boolean(journey.share_token?.trim()),
    });
    stampClientWorkspaceListLink(index, journey, link);
    for (const review of related) {
      assignedReviewIds.add(review.id);
      stampClientWorkspaceListLink(index, review, link);
    }
  }

  const leftover = unscoped.filter((review) => !assignedReviewIds.has(review.id));
  const leftoverGroups = new Map<string, ClientWorkspaceReviewLinkRow[]>();
  for (const review of leftover) {
    const key =
      review.shortlist_id?.trim() ||
      review.quotation_id?.trim() ||
      review.campaign_header_id?.trim();
    if (!key) continue;
    const list = leftoverGroups.get(key) ?? [];
    list.push(review);
    leftoverGroups.set(key, list);
  }
  for (const group of leftoverGroups.values()) {
    const latest = latestClientWorkspaceReview(group);
    const link = campaignClientWorkspaceLinkFromLatest({
      latestStatus: latest?.status,
      reviewNumber: latest?.review_number,
    });
    for (const review of group) {
      stampClientWorkspaceListLink(index, review, link);
    }
  }

  return index;
}

export function clientWorkspaceListLinkForSubject(
  index: ClientWorkspaceListLinkIndex,
  subject: {
    shortlistId?: string | null;
    quotationId?: string | null;
    campaignHeaderId?: string | null;
  }
): ClientWorkspaceListLink | undefined {
  const campaignHeaderId = subject.campaignHeaderId?.trim();
  if (campaignHeaderId && index.byCampaignHeaderId.has(campaignHeaderId)) {
    return index.byCampaignHeaderId.get(campaignHeaderId);
  }
  const quotationId = subject.quotationId?.trim();
  if (quotationId && index.byQuotationId.has(quotationId)) {
    return index.byQuotationId.get(quotationId);
  }
  const shortlistId = subject.shortlistId?.trim();
  if (shortlistId && index.byShortlistId.has(shortlistId)) {
    return index.byShortlistId.get(shortlistId);
  }
  return undefined;
}

/** Copy one journey’s Active / Off state onto related shortlist, quotation, and campaign rows. */
export function propagateClientWorkspaceListLinks(
  index: ClientWorkspaceListLinkIndex,
  subjects: ReadonlyArray<{
    shortlistId?: string | null;
    quotationId?: string | null;
    campaignHeaderId?: string | null;
  }>
): void {
  for (const subject of subjects) {
    const link = clientWorkspaceListLinkForSubject(index, subject);
    if (!link) continue;
    stampClientWorkspaceListLink(index, subject, link);
  }
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
