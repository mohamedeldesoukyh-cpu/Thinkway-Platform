import type { ClientClassificationSource } from "@/lib/clients/classify-client-category-types";

/** Confidence below this threshold flags a client for human review. */
export const REVIEW_CONFIDENCE_THRESHOLD = 80;

export function computeNeedsReview(
  confidence: number,
  source: ClientClassificationSource
): boolean {
  return confidence < REVIEW_CONFIDENCE_THRESHOLD || source === "ai_search";
}

export function isReviewConfidence(confidence: number): boolean {
  return confidence < REVIEW_CONFIDENCE_THRESHOLD;
}
