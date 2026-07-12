/**
 * AI Campaign Director — recommendation types.
 *
 * The Director reviews the complete Campaign Object and proposes improvements.
 * It never mutates the campaign itself: every recommendation is reviewable and,
 * when applicable, carries a `proposedCommand` the user can Apply — which routes
 * through the existing Campaign Copilot (reusing its deterministic mutation +
 * versioning). Advisory recommendations (already reflected when outputs
 * generate) carry no command. Recommendations are always grounded in the
 * Campaign Object — the Director never invents campaign information.
 */

export type DirectorConfidence = "High" | "Medium" | "Low";

export type DirectorRecommendationCategory =
  | "completeness"
  | "sequencing"
  | "phasing"
  | "platforms"
  | "services"
  | "amplification"
  | "budget"
  | "pacing"
  | "contingency"
  | "timeline"
  | "diversity";

export type DirectorRecommendation = {
  id: string;
  category: DirectorRecommendationCategory;
  /** Short imperative, e.g. "Lead with TikTok". */
  title: string;
  /** The full recommendation. */
  recommendation: string;
  /** Why — grounded in the Campaign Object. */
  reason: string;
  confidence: DirectorConfidence;
  /** What the reasoning is grounded in (campaign facts, slate, benchmarks). */
  evidence: string[];
  /**
   * A natural-language command that applies this recommendation through the
   * existing Copilot (mutation + versioning). Absent for advisory-only
   * recommendations already reflected in the generated outputs.
   */
  proposedCommand?: string;
};

export type DirectorReview = {
  recommendations: DirectorRecommendation[];
  summary: string;
};
