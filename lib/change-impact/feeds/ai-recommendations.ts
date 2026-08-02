import type { ChangeImpactAiRecommendation, ChangeImpactAssessment } from "@/lib/change-impact/types";

/**
 * AI-ready projection — do not execute AI.
 * Future automation consumes this shape from assessments.ai_context.
 */
export function projectChangeImpactAiRecommendation(
  assessment: ChangeImpactAssessment
): ChangeImpactAiRecommendation {
  return assessment.aiRecommendation;
}

export function formatChangeImpactAiBrief(
  recommendation: ChangeImpactAiRecommendation
): string {
  const lines = [
    `AI detected: ${recommendation.summary}`,
    recommendation.recommendBulkRegenerate
      ? "Recommendation: Bulk regenerate impacted documents."
      : `Recommendation: ${recommendation.suggestedActions[0] ?? "Review impact."}`,
  ];
  if (recommendation.estimatedImpact?.amountDelta != null) {
    lines.push(
      `Estimated impact: ${recommendation.estimatedImpact.amountDelta} ${recommendation.estimatedImpact.currencyCode ?? ""}`.trim()
    );
  }
  return lines.join("\n");
}
