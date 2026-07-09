/**
 * Confidence scoring for Creator DNA fields.
 */

import type { DnaSource } from "../types";

const BASE_CONFIDENCE: Record<DnaSource, number> = {
  manual: 1.0,
  campaign: 0.92,
  oauth: 0.95,
  ipl: 0.88,
  ai_infer: 0.62,
};

export function calculateConfidence(input: {
  source: DnaSource;
  hasValue: boolean;
  isVerified?: boolean;
  snapshotVersion?: number | null;
  fieldCompleteness?: number;
}): number {
  let score = BASE_CONFIDENCE[input.source];

  if (!input.hasValue) {
    return 0;
  }

  if (input.isVerified && input.source === "ipl") {
    score = Math.min(0.98, score + 0.05);
  }

  if (input.snapshotVersion != null && input.snapshotVersion > 1) {
    score = Math.min(0.99, score + Math.min(0.03, input.snapshotVersion * 0.005));
  }

  if (input.fieldCompleteness != null) {
    score = score * (0.7 + input.fieldCompleteness * 0.3);
  }

  return Math.round(score * 1000) / 1000;
}

export function calculateFieldCompleteness(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? 1 : 0;
  if (typeof value === "boolean") return 1;
  if (typeof value === "string") return value.trim().length > 0 ? 1 : 0;
  if (Array.isArray(value)) return value.length > 0 ? Math.min(1, value.length / 5) : 0;
  return 0.5;
}
