"use server";

import { requireStudioUser } from "@/features/campaign-studio/actions/persist-campaign-object-on-message";

import { loadLatestInternalReview } from "../load-client-workspace";

export async function loadLatestClientReviewAction(campaignObjectId: string) {
  const { supabase } = await requireStudioUser();
  const review = await loadLatestInternalReview(supabase, campaignObjectId);
  if (!review) return { ok: true as const, review: null };
  const accepted = Object.values(review.selectionState).filter((s) => s === "accepted").length;
  const rejected = Object.values(review.selectionState).filter((s) => s === "rejected").length;
  const inReview = Object.values(review.selectionState).filter((s) => s === "in_review").length;
  return {
    ok: true as const,
    review: {
      id: review.id,
      reviewNumber: review.reviewNumber,
      status: review.status,
      changeRequestSummary: review.changeRequestSummary,
      accepted,
      rejected,
      inReview,
      updatedAt: review.updatedAt,
    },
  };
}
