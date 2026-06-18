import type { ClientClassificationSource } from "@/lib/clients/classify-client-category-types";
import { computeNeedsReview } from "@/lib/clients/client-classification-review";

export type ClassificationAuditInput = {
  clientCategory: string | null;
  clientSubcategory: string | null;
  suggestionAccepted: boolean;
  categoryManuallySet: boolean;
  suggestionSource?: ClientClassificationSource | null;
  suggestionConfidence?: number | null;
  suggestionReason?: string | null;
};

export type ClassificationAuditPayload = {
  classification_source: ClientClassificationSource | null;
  classification_confidence: number | null;
  classification_reason: string | null;
  classified_at: string | null;
  approved_by_user: string | null;
  last_verified_at: string | null;
  needs_review: boolean;
};

const EMPTY_AUDIT: ClassificationAuditPayload = {
  classification_source: null,
  classification_confidence: null,
  classification_reason: null,
  classified_at: null,
  approved_by_user: null,
  last_verified_at: null,
  needs_review: false,
};

export function buildClassificationAuditPayload(
  input: ClassificationAuditInput,
  userId: string,
  now: string
): ClassificationAuditPayload {
  const hasCategory = Boolean(input.clientCategory && input.clientSubcategory);
  if (!hasCategory) {
    return { ...EMPTY_AUDIT };
  }

  const manualClassification =
    input.categoryManuallySet || !input.suggestionAccepted;

  if (manualClassification) {
    return {
      classification_source: "approved",
      classification_confidence: 100,
      classification_reason: "Manual classification",
      classified_at: now,
      approved_by_user: userId,
      last_verified_at: now,
      needs_review: false,
    };
  }

  const source = input.suggestionSource ?? "approved";
  const confidence = input.suggestionConfidence ?? 100;
  const needsReview = computeNeedsReview(confidence, source);

  return {
    classification_source: source,
    classification_confidence: confidence,
    classification_reason: input.suggestionReason ?? null,
    classified_at: now,
    approved_by_user: userId,
    last_verified_at: needsReview ? null : now,
    needs_review: needsReview,
  };
}
