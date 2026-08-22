import { CLIENT_STATUS_LABEL } from "./constants";
import type {
  ClientQuotationStage,
  ClientReviewDecisionStage,
  ClientReviewSource,
  ClientReviewStatus,
  ClientShortlistStage,
} from "./constants";
import { isFrozenClientReviewStatus, isInteractiveClientReview } from "./status";
import type {
  ClientReviewRecord,
  ClientReviewSourceSnapshot,
  ClientWorkspaceJourney,
} from "./types";

export { isFrozenClientReviewStatus, isReusableClientReviewTip } from "./status";
export type { ClientQuotationStage, ClientReviewDecisionStage, ClientShortlistStage };

export type ClientJourneyNodeId =
  | "shortlist"
  | "quotation"
  | "final_approval"
  | "campaign"
  | "performance"
  | "invoice";

export type ClientJourneyNodeTone = "idle" | "active" | "attention" | "ok" | "bad";

export function canLiveSyncClientReview(input: {
  status: ClientReviewStatus;
  source: ClientReviewSource;
  campaignHeaderId?: string | null;
}): boolean {
  if (input.source !== "quotation") return false;
  if (input.campaignHeaderId) return false;
  return isInteractiveClientReview(input.status);
}

export function deriveShortlistStage(input: {
  review: (Pick<ClientReviewRecord, "status"> & { firstViewedAt?: string | null }) | null;
}): ClientShortlistStage {
  if (!input.review) return "not_sent";
  if (input.review.status === "approved") return "approved";
  if (input.review.status === "changes_requested") return "changes_requested";
  if (input.review.status === "rejected" || input.review.status === "revoked") return "not_sent";
  if (input.review.firstViewedAt) return "viewed";
  return "sent";
}

export function deriveQuotationStage(input: {
  quotationExists: boolean;
  review: (Pick<ClientReviewRecord, "status"> & { firstViewedAt?: string | null }) | null;
  priorApprovedReview: boolean;
  movedToCampaign: boolean;
}): ClientQuotationStage {
  if (input.review?.status === "superseded") return "superseded";
  if (input.review?.status === "approved" || input.movedToCampaign) return "approved";
  if (input.review?.status === "rejected") return "rejected";
  if (!input.quotationExists && !input.review) return "draft";
  if (!input.review) return "draft";
  if (input.review.status === "changes_requested") return "changes_requested";
  if (input.priorApprovedReview && input.review.status === "awaiting_review") return "updated";
  if (input.review.firstViewedAt) return "viewed";
  return "sent_for_approval";
}

export const SHORTLIST_STAGE_LABEL: Record<ClientShortlistStage, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  viewed: "Viewed",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const QUOTATION_STAGE_LABEL: Record<ClientQuotationStage, string> = {
  draft: "Draft",
  sent_for_approval: "Sent for approval",
  viewed: "Viewed",
  changes_requested: "Changes requested",
  updated: "Updated — Approval required",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Historical / Superseded",
};

export function shortlistStageTone(stage: ClientShortlistStage): ClientJourneyNodeTone {
  if (stage === "approved") return "ok";
  if (stage === "changes_requested") return "attention";
  if (stage === "sent" || stage === "viewed") return "active";
  return "idle";
}

export function quotationStageTone(stage: ClientQuotationStage): ClientJourneyNodeTone {
  if (stage === "approved") return "ok";
  if (stage === "rejected") return "bad";
  if (stage === "updated" || stage === "changes_requested") return "attention";
  if (stage === "sent_for_approval" || stage === "viewed") return "active";
  return "idle";
}

export function latestReviewForSource<
  T extends Pick<ClientReviewRecord, "source" | "status" | "reviewNumber" | "createdAt">,
>(reviews: T[], source: ClientReviewSource): T | null {
  const scoped = reviews
    .filter((review) => review.source === source && review.status !== "revoked")
    .sort(
      (left, right) =>
        right.reviewNumber - left.reviewNumber || right.createdAt.localeCompare(left.createdAt)
    );
  return scoped[0] ?? null;
}

export function latestApprovedReviewForSource<
  T extends Pick<ClientReviewRecord, "source" | "status" | "reviewNumber" | "createdAt">,
>(reviews: T[], source: ClientReviewSource): T | null {
  const scoped = reviews
    .filter((review) => review.source === source && review.status === "approved")
    .sort(
      (left, right) =>
        right.reviewNumber - left.reviewNumber || right.createdAt.localeCompare(left.createdAt)
    );
  return scoped[0] ?? null;
}

export function journeyCanonicalReviewId(
  reviews: Pick<ClientReviewRecord, "id" | "source" | "createdAt">[],
  fallbackId: string
): string {
  const ordered = [...reviews].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const firstShortlist = ordered.find((review) => review.source === "shortlist");
  return firstShortlist?.id ?? ordered[0]?.id ?? fallbackId;
}

export type ClientJourneyMember = {
  id: string;
  source: ClientReviewSource;
  status: ClientReviewStatus;
  reviewNumber: number;
  createdAt: string;
  firstViewedAt?: string | null;
  journeyId?: string | null;
  quotationId?: string | null;
  shortlistId?: string | null;
  campaignHeaderId?: string | null;
};

export function pickActiveDecisionReview<T extends ClientJourneyMember>(input: {
  reviews: T[];
  requestedReviewId?: string | null;
  canonicalReviewId?: string | null;
  tokenBoundReviewId?: string | null;
}): { review: T | null; historical: boolean } {
  const { reviews, requestedReviewId, canonicalReviewId, tokenBoundReviewId } = input;
  const candidateIds = [requestedReviewId, tokenBoundReviewId].filter(
    (value): value is string => Boolean(value && value !== canonicalReviewId)
  );
  for (const candidateId of candidateIds) {
    const requested = reviews.find((review) => review.id === candidateId);
    if (!requested) continue;
    const latestSameSource = latestReviewForSource(reviews, requested.source);
    const historical = Boolean(
      latestSameSource &&
        latestSameSource.id !== requested.id &&
        isFrozenClientReviewStatus(requested.status)
    );
    if (historical) return { review: requested, historical: true };
  }

  const quotationTip = latestReviewForSource(reviews, "quotation");
  if (quotationTip) return { review: quotationTip, historical: false };
  const shortlistTip = latestReviewForSource(reviews, "shortlist");
  if (shortlistTip) return { review: shortlistTip, historical: false };
  const studioTip = latestReviewForSource(reviews, "studio");
  return { review: studioTip, historical: false };
}

export type ClientApprovalSideEffects = {
  lockCommercial: boolean;
  setQuotationStatusApproved: boolean;
  createQuotation: boolean;
  rejectPairedShortlist: boolean;
};

export function clientApprovalSideEffects(
  source: ClientReviewSource,
  decision: "approved" | "rejected"
): ClientApprovalSideEffects {
  if (decision === "rejected") {
    return {
      lockCommercial: false,
      setQuotationStatusApproved: false,
      createQuotation: false,
      rejectPairedShortlist: false,
    };
  }
  if (source === "shortlist") {
    return {
      lockCommercial: false,
      setQuotationStatusApproved: false,
      createQuotation: false,
      rejectPairedShortlist: false,
    };
  }
  if (source === "quotation") {
    return {
      lockCommercial: true,
      setQuotationStatusApproved: true,
      createQuotation: false,
      rejectPairedShortlist: false,
    };
  }
  return {
    lockCommercial: true,
    setQuotationStatusApproved: false,
    createQuotation: true,
    rejectPairedShortlist: false,
  };
}

export function pickReviewForDecision<T extends ClientJourneyMember>(
  reviews: T[],
  stage: ClientReviewDecisionStage
): T | null {
  return latestReviewForSource(reviews, stage);
}

export function reviewIdBelongsToJourney(
  reviewId: string,
  input: {
    canonicalReviewId?: string | null;
    memberReviewIds?: string[];
    activeReviewId?: string | null;
    journeyId?: string | null;
  }
): boolean {
  if (input.activeReviewId === reviewId) return true;
  if (input.canonicalReviewId === reviewId) return true;
  if (input.journeyId === reviewId) return true;
  return Boolean(input.memberReviewIds?.includes(reviewId));
}

export function clientWorkspacePathReviewId(input: {
  historical: boolean;
  viewedReviewId: string;
  canonicalReviewId?: string | null;
}): string {
  if (input.historical) return input.viewedReviewId;
  return input.canonicalReviewId || input.viewedReviewId;
}

export function clientWorkspaceVersionPill(input: {
  historical: boolean;
  reviewNumber: number;
  newerReviewNumber: number | null;
}): string {
  if (input.historical) return `Historical · v${input.reviewNumber}`;
  if (input.newerReviewNumber) return `Updated · v${input.newerReviewNumber}`;
  return `Current · v${input.reviewNumber}`;
}

export type ApprovalWorkspaceKind = "historical" | "quotation_approved" | "open" | "idle";

export function approvalWorkspaceKind(input: {
  historical: boolean;
  quotationStage: ClientQuotationStage;
  canApproveShortlist: boolean;
  canApproveQuotation: boolean;
  selectedCount?: number;
}): ApprovalWorkspaceKind {
  if (input.historical) return "historical";
  if (input.quotationStage === "approved") {
    if ((input.selectedCount ?? 1) === 0) return "idle";
    return "quotation_approved";
  }
  if (input.canApproveShortlist || input.canApproveQuotation) return "open";
  return "idle";
}

export function canMutateClientReviewFromBoundReview(input: {
  reviews: ClientJourneyMember[];
  boundReviewId: string;
  canonicalReviewId: string;
}): boolean {
  const picked = pickActiveDecisionReview({
    reviews: input.reviews,
    requestedReviewId: input.boundReviewId,
    canonicalReviewId: input.canonicalReviewId,
    tokenBoundReviewId: input.boundReviewId,
  });
  if (!picked.review || picked.historical) return false;
  return isInteractiveClientReview(picked.review.status);
}

export function projectClientJourney(input: {
  members: ClientJourneyMember[];
  viewed: ClientJourneyMember;
  historical: boolean;
  canonicalReviewId: string;
}): ClientWorkspaceJourney {
  const shortlistTip = latestReviewForSource(input.members, "shortlist");
  const quotationLatest = latestReviewForSource(input.members, "quotation");
  const memberReviewIds = input.members.map((item) => item.id);
  const journeyId = input.viewed.journeyId ?? input.viewed.id;

  if (input.historical) {
    const viewedQuotation = input.viewed.source === "quotation" ? input.viewed : null;
    const viewedShortlist = input.viewed.source === "shortlist" ? input.viewed : shortlistTip;
    return {
      id: journeyId,
      canonicalReviewId: input.canonicalReviewId,
      memberReviewIds,
      shortlistStage: deriveShortlistStage({ review: viewedShortlist }),
      quotationStage: viewedQuotation
        ? "superseded"
        : deriveQuotationStage({
            quotationExists: Boolean(input.viewed.quotationId),
            review: null,
            priorApprovedReview: false,
            movedToCampaign: false,
          }),
      campaignStarted: false,
      performanceStarted: false,
      invoiceStarted: false,
      campaignHeaderId: null,
      quotationId: input.viewed.quotationId ?? null,
      shortlistId: input.viewed.shortlistId ?? shortlistTip?.shortlistId ?? null,
      historical: true,
      canApproveShortlist: false,
      canApproveQuotation: false,
      canConfirmCreators: false,
      canApproveFinalQuotation: false,
      selectionConfirmed: false,
      approvedQuotationCount: 0,
      canRequestShortlistChanges: false,
      canRequestQuotationChanges: false,
      canRejectQuotation: false,
      movedToCampaign: false,
    };
  }

  const quotationApprovedPrior = input.members.some(
    (item) =>
      item.source === "quotation" &&
      item.status === "approved" &&
      quotationLatest != null &&
      item.id !== quotationLatest.id
  );
  const movedToCampaign = Boolean(
    quotationLatest?.campaignHeaderId || input.members.some((item) => item.campaignHeaderId)
  );
  const approvedQuotationCount = input.members.filter(
    (item) => item.source === "quotation" && item.status === "approved"
  ).length;
  const shortlistStage = deriveShortlistStage({ review: shortlistTip });
  const quotationStage = deriveQuotationStage({
    quotationExists: Boolean(quotationLatest?.quotationId),
    review: quotationLatest,
    priorApprovedReview: quotationApprovedPrior,
    movedToCampaign,
  });
  return {
    id: journeyId,
    canonicalReviewId: input.canonicalReviewId,
    memberReviewIds,
    shortlistStage,
    quotationStage,
    campaignStarted: movedToCampaign,
    performanceStarted: movedToCampaign,
    invoiceStarted: false,
    campaignHeaderId: input.viewed.campaignHeaderId ?? quotationLatest?.campaignHeaderId ?? null,
    quotationId: quotationLatest?.quotationId ?? input.viewed.quotationId ?? null,
    shortlistId: shortlistTip?.shortlistId ?? input.viewed.shortlistId ?? null,
    historical: false,
    canApproveShortlist:
      !movedToCampaign && isInteractiveClientReview(shortlistTip?.status ?? "revoked"),
    canApproveQuotation:
      !movedToCampaign && isInteractiveClientReview(quotationLatest?.status ?? "revoked"),
    canConfirmCreators: false,
    canApproveFinalQuotation: false,
    selectionConfirmed: false,
    approvedQuotationCount,
    canRequestShortlistChanges: isInteractiveClientReview(shortlistTip?.status ?? "revoked"),
    canRequestQuotationChanges:
      !movedToCampaign && isInteractiveClientReview(quotationLatest?.status ?? "revoked"),
    canRejectQuotation:
      !movedToCampaign && isInteractiveClientReview(quotationLatest?.status ?? "revoked"),
    movedToCampaign,
  };
}

export function journeyActionRequired(input: {
  shortlistStage: ClientShortlistStage;
  quotationStage: ClientQuotationStage;
  historical: boolean;
  selectionConfirmed?: boolean;
  canConfirmCreators?: boolean;
  canApproveFinalQuotation?: boolean;
  selectedCount?: number;
}): string {
  if (input.historical) return "This is a frozen historical version";
  if (input.quotationStage === "updated") return "Updated quotation — final quotation approval required";
  if (input.canApproveFinalQuotation) return "Approve final quotation";
  if (input.canConfirmCreators) return "Approve selected creators";
  if (input.quotationStage === "approved" && (input.selectedCount ?? 0) === 0) {
    return "This quotation has no client-selected creators. Thinkway needs to send an updated quotation.";
  }
  if (input.selectionConfirmed && (input.quotationStage === "sent_for_approval" || input.quotationStage === "viewed")) {
    return "Approve final quotation";
  }
  if (input.quotationStage === "sent_for_approval" || input.quotationStage === "viewed") {
    return "Select creators, then approve selected creators";
  }
  if (input.quotationStage === "changes_requested") {
    return "Waiting for Thinkway to update the quotation";
  }
  if (input.quotationStage === "approved") return "Thinkway is setting up your campaign";
  if (input.quotationStage === "rejected") return "Quotation rejected";
  if (input.shortlistStage === "sent" || input.shortlistStage === "viewed") {
    return "Review shortlist (optional)";
  }
  if (input.shortlistStage === "changes_requested") {
    return "Waiting for Thinkway to update the shortlist";
  }
  if (input.shortlistStage === "approved") return "Shortlist approved — quotation can follow";
  return CLIENT_STATUS_LABEL.awaiting_review;
}

export function snapshotForReview(review: ClientReviewRecord | null): ClientReviewSourceSnapshot | null {
  return review?.sourceSnapshot ?? null;
}
