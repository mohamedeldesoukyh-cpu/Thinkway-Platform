export type ClientClassificationSource =
  | "approved"
  | "rule"
  | "historical"
  | "ai_search"
  | "fallback";

export type ClientCategoryClassification = {
  categorySlug: string;
  subcategorySlug: string;
  /** 0–100 confidence score */
  confidence: number;
  source: ClientClassificationSource;
  reason?: string;
};

export type ApprovedClientClassification = {
  categorySlug: string;
  subcategorySlug: string;
  source: ClientClassificationSource | null;
  confidence: number | null;
  reason: string | null;
  approvedByUser: string | null;
};

export type HistoricalClassificationMatch = {
  categorySlug: string;
  subcategorySlug: string;
  matchedName: string;
  confidence: number;
};

export const CLASSIFICATION_CONFIDENCE = {
  rule: { min: 95, max: 100 },
  historical: { min: 90, max: 100 },
  aiSearch: { min: 70, max: 95 },
  fallback: { max: 69 },
  approved: 100,
} as const;

import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/clients/client-classification-review";

export function isLowConfidenceClassification(confidence: number): boolean {
  return confidence < REVIEW_CONFIDENCE_THRESHOLD;
}

export function classificationSourceLabel(source: ClientClassificationSource): string {
  switch (source) {
    case "approved":
      return "Approved classification";
    case "rule":
      return "Rule match";
    case "historical":
      return "Historical match";
    case "ai_search":
      return "AI + company search";
    case "fallback":
      return "Keyword fallback";
    default:
      return "Classification";
  }
}
