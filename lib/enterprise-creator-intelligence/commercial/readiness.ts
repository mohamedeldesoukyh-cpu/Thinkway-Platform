import type {
  CommercialMetric,
  InvestmentReadiness,
  InvestmentReadinessStatus,
} from "@/lib/enterprise-creator-intelligence/commercial/types";

/**
 * Investment readiness for Planning Workspace — not the Creator Investment Score.
 */
export function computeInvestmentReadiness(input: {
  metrics: CommercialMetric[];
  campaignCount: number;
}): InvestmentReadiness {
  const { metrics, campaignCount } = input;
  const withValues = metrics.filter((m) => m.currentValue != null);
  const metricCoverage = withValues.length / Math.max(metrics.length, 1);
  const confidences = withValues
    .map((m) => m.confidence.percent)
    .filter((v): v is number => v != null);
  const averageConfidence =
    confidences.length > 0
      ? Math.round(
          confidences.reduce((s, n) => s + n, 0) / confidences.length
        )
      : null;

  const hasCampaignCommercial = metrics.some(
    (m) =>
      (m.key === "cpm" || m.key === "cpe" || m.key === "roi") &&
      m.currentValue != null
  );
  const hasHistoricalOnly =
    !hasCampaignCommercial &&
    metrics.some(
      (m) =>
        (m.key === "average_views" || m.key === "median_views") &&
        m.currentValue != null
    );

  const blockers: string[] = [];
  let status: InvestmentReadinessStatus;

  if (campaignCount < 1 && !hasHistoricalOnly) {
    status = "Needs More Data";
    blockers.push("No Thinkway campaign history or commercial captures.");
  } else if (campaignCount < 1 && hasHistoricalOnly) {
    status = "Historical Only";
    blockers.push("Platform historical metrics only — no campaign commercial results yet.");
  } else if (campaignCount < 2) {
    status = "Insufficient Campaign History";
    blockers.push("Fewer than 2 Thinkway campaigns for commercial planning confidence.");
  } else if (averageConfidence != null && averageConfidence < 50) {
    status = "Limited Confidence";
    blockers.push("Average commercial confidence below 50%.");
  } else if (metricCoverage < 0.4) {
    status = "Needs More Data";
    blockers.push("Fewer than 40% of commercial metrics are populated.");
  } else {
    status = "Commercial Ready";
  }

  const summary =
    status === "Commercial Ready"
      ? "Creator has enough Thinkway commercial signal for Planning Workspace."
      : `Readiness: ${status}.`;

  return {
    status,
    summary,
    blockers,
    campaignCount,
    metricCoverage: Number(metricCoverage.toFixed(3)),
    averageConfidence,
  };
}
