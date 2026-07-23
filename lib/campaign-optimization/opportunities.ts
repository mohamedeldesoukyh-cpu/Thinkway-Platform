import type { AnalyzerFinding, OptimizationOpportunity } from "./types";

const IMPACT_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function findingsToOpportunities(findings: AnalyzerFinding[]): OptimizationOpportunity[] {
  return findings
    .filter((finding) => finding.title && finding.category)
    .map((finding, index) => ({
      id: `opp_${finding.category}_${index + 1}`,
      category: finding.category,
      impact: finding.impact,
      title: finding.title,
      summary: finding.summary,
      expectedReachGainPct: finding.expectedReachGainPct ?? null,
      expectedViewGainPct: finding.expectedViewGainPct ?? null,
      expectedEngagementGainPct: finding.expectedEngagementGainPct ?? null,
      expectedBudgetSavingsPct: finding.expectedBudgetSavingsPct ?? null,
      triggeredMetrics: finding.triggeredMetrics,
      confidence: finding.confidence ?? 60,
    }))
    .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);
}

export function countOpportunitiesByImpact(
  opportunities: OptimizationOpportunity[]
): { high: number; medium: number; low: number } {
  return opportunities.reduce(
    (acc, opp) => {
      acc[opp.impact] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
}
