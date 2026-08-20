import { CLIENT_STATUS_LABEL } from "./constants";
import type {
  ClientQuotationStage,
  ClientReviewDecisionStage,
  ClientReviewSource,
  ClientReviewStatus,
  ClientShortlistStage,
} from "./constants";
import { isFrozenClientReviewStatus, isInteractiveClientReview } from "./status";
import type { ClientReviewRecord, ClientReviewSourceSnapshot } from "./types";

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
  review: Pick<ClientReviewRecord, "status" | "firstViewedAt"> | null;
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
  review: Pick<ClientReviewRecord, "status" | "firstViewedAt"> | null;
  priorApprovedReview: boolean;
  movedToCampaign: boolean;
}): ClientQuotationStage {
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

export function latestReviewForSource(
  reviews: ClientReviewRecord[],
  source: ClientReviewSource
): ClientReviewRecord | null {
  const scoped = reviews
    .filter((review) => review.source === source && review.status !== "revoked")
    .sort(
      (left, right) =>
        right.reviewNumber - left.reviewNumber || right.createdAt.localeCompare(left.createdAt)
    );
  return scoped[0] ?? null;
}

export function latestApprovedReviewForSource(
  reviews: ClientReviewRecord[],
  source: ClientReviewSource
): ClientReviewRecord | null {
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

export function pickActiveDecisionReview(input: {
  reviews: ClientReviewRecord[];
  requestedReviewId?: string | null;
  canonicalReviewId?: string | null;
  tokenBoundReviewId?: string | null;
}): { review: ClientReviewRecord | null; historical: boolean } {
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

export function pickReviewForDecision(
  reviews: ClientReviewRecord[],
  stage: ClientReviewDecisionStage
): ClientReviewRecord | null {
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

export function journeyActionRequired(input: {
  shortlistStage: ClientShortlistStage;
  quotationStage: ClientQuotationStage;
  historical: boolean;
}): string {
  if (input.historical) return "This is a frozen historical version";
  if (input.quotationStage === "updated") return "Review the updated quotation";
  if (input.quotationStage === "sent_for_approval" || input.quotationStage === "viewed") {
    return "Approve quotation";
  }
  if (input.quotationStage === "changes_requested") {
    return "Waiting for Thinkway to update the quotation";
  }
  if (input.quotationStage === "approved") return "Quotation approved — Thinkway can convert to campaign";
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
