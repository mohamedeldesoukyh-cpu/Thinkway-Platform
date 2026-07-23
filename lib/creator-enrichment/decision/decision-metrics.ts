import { logDecisionEvent } from "./decision-logging";
import type { DecisionOutcome } from "./decision-types";

export type DecisionMetricsSnapshot = Readonly<{
  totalDecisions: number;
  proceedCount: number;
  skipCount: number;
  alreadyRunningCount: number;
  forceRefreshCount: number;
  averageDecisionTimeMs: number;
  averageSnapshotBuildTimeMs: number;
}>;

const metrics = {
  totalDecisions: 0,
  proceedCount: 0,
  skipCount: 0,
  alreadyRunningCount: 0,
  forceRefreshCount: 0,
  totalDecisionTimeMs: 0,
  totalSnapshotBuildTimeMs: 0,
};

export function recordDecisionMetrics(input: {
  decision: DecisionOutcome;
  decisionTimeMs: number;
  snapshotBuildTimeMs: number;
  force: boolean;
  winningRule: string | null;
}): DecisionMetricsSnapshot {
  metrics.totalDecisions += 1;
  metrics.totalDecisionTimeMs += input.decisionTimeMs;
  metrics.totalSnapshotBuildTimeMs += input.snapshotBuildTimeMs;

  switch (input.decision) {
    case "proceed":
      metrics.proceedCount += 1;
      break;
    case "skip":
      metrics.skipCount += 1;
      break;
    case "already_running":
      metrics.alreadyRunningCount += 1;
      break;
  }

  if (input.force || input.winningRule === "ForceRule") {
    metrics.forceRefreshCount += 1;
  }

  const snapshot = getDecisionMetricsSnapshot();
  logDecisionEvent("decision_metrics", snapshot as unknown as Record<string, unknown>);
  return snapshot;
}

export function getDecisionMetricsSnapshot(): DecisionMetricsSnapshot {
  const total = metrics.totalDecisions;
  return Object.freeze({
    totalDecisions: total,
    proceedCount: metrics.proceedCount,
    skipCount: metrics.skipCount,
    alreadyRunningCount: metrics.alreadyRunningCount,
    forceRefreshCount: metrics.forceRefreshCount,
    averageDecisionTimeMs:
      total === 0 ? 0 : Math.round(metrics.totalDecisionTimeMs / total),
    averageSnapshotBuildTimeMs:
      total === 0 ? 0 : Math.round(metrics.totalSnapshotBuildTimeMs / total),
  });
}

export function resetDecisionMetricsForTests(): void {
  metrics.totalDecisions = 0;
  metrics.proceedCount = 0;
  metrics.skipCount = 0;
  metrics.alreadyRunningCount = 0;
  metrics.forceRefreshCount = 0;
  metrics.totalDecisionTimeMs = 0;
  metrics.totalSnapshotBuildTimeMs = 0;
}
