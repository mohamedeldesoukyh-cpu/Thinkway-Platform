import type {
  AnalyzerFinding,
  OptimizationOpportunity,
  OptimizationRecommendation,
} from "./types";

function confidenceLabel(score: number): "low" | "medium" | "high" {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function formatExpectedImpact(finding: AnalyzerFinding): string {
  const parts: string[] = [];
  if (finding.expectedReachGainPct != null) {
    parts.push(`+${finding.expectedReachGainPct}% estimated reach`);
  }
  if (finding.expectedViewGainPct != null) {
    parts.push(`+${finding.expectedViewGainPct}% estimated views`);
  }
  if (finding.expectedEngagementGainPct != null) {
    parts.push(`+${finding.expectedEngagementGainPct}% estimated engagement`);
  }
  if (finding.expectedBudgetSavingsPct != null) {
    parts.push(`~${finding.expectedBudgetSavingsPct}% budget efficiency gain`);
  }
  return parts.length ? parts.join("; ") : "Improved campaign efficiency expected.";
}

export function buildRecommendations(
  findings: AnalyzerFinding[],
  opportunities: OptimizationOpportunity[]
): OptimizationRecommendation[] {
  return findings
    .filter((finding) => finding.recommendationAction)
    .map((finding, index) => {
      const opportunity =
        opportunities.find(
          (item) => item.category === finding.category && item.title === finding.title
        ) ?? opportunities[index];
      const confidence = finding.confidence ?? 60;
      return {
        id: `rec_${finding.category}_${index + 1}`,
        opportunityId: opportunity?.id ?? `opp_${finding.category}_${index + 1}`,
        category: finding.category,
        impact: finding.impact,
        action: finding.recommendationAction!,
        expectedImpact: formatExpectedImpact(finding),
        confidence,
        confidenceLabel: confidenceLabel(confidence),
        reasoning: finding.recommendationReasoning ?? [finding.summary],
        triggeredMetrics: finding.triggeredMetrics,
        kpiDelta: finding.kpiDelta,
      } satisfies OptimizationRecommendation;
    });
}

export function enrichRecommendationWithCreator(
  recommendation: OptimizationRecommendation,
  creatorName: string
): OptimizationRecommendation {
  if (recommendation.action.includes(creatorName)) return recommendation;
  return {
    ...recommendation,
    action: recommendation.action.replace("one macro creator", creatorName),
  };
}
