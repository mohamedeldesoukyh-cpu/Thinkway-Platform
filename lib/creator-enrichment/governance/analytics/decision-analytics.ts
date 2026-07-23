import type { DecisionOutcome, RuleEvaluation } from "@/lib/creator-enrichment/decision/decision-types";
import { logDecisionEvent } from "@/lib/creator-enrichment/decision/decision-logging";

export type DecisionAnalyticsRecord = Readonly<{
  decisionId: string;
  traceId: string;
  requestId: string;
  decision: DecisionOutcome;
  winningRule: string | null;
  reason: string;
  force: boolean;
  feature: string;
  operation: string;
  decisionTimeMs: number;
  snapshotBuildTimeMs: number;
  snapshotCompleteness: number;
  estimatedApifySavings: number;
  estimatedDurationSavingsMs: number;
  optimizationPercentage: number;
  recordedAt: string;
}>;

export type DecisionAnalyticsSnapshot = Readonly<{
  totalRecords: number;
  proceedCount: number;
  skipCount: number;
  alreadyRunningCount: number;
  proceedRate: number;
  skipRate: number;
  alreadyRunningRate: number;
  forceRefreshCount: number;
  averageDecisionTimeMs: number;
  averageSnapshotBuildTimeMs: number;
  averageOptimizationPercentage: number;
  totalEstimatedApifySavings: number;
  totalEstimatedDurationSavingsMs: number;
  ruleUtilization: Readonly<Record<string, number>>;
  winningRuleCounts: Readonly<Record<string, number>>;
  optimizationOpportunityCount: number;
}>;

const records: DecisionAnalyticsRecord[] = [];
const ruleUtilization: Record<string, number> = {};
const winningRuleCounts: Record<string, number> = {};

const MAX_RECORDS = 5_000;

export function recordDecisionAnalytics(input: {
  decisionId: string;
  traceId: string;
  requestId: string;
  decision: DecisionOutcome;
  winningRule: string | null;
  reason: string;
  force: boolean;
  feature: string;
  operation: string;
  decisionTimeMs: number;
  snapshotBuildTimeMs: number;
  snapshotCompleteness: number;
  ruleEvaluations: readonly RuleEvaluation[];
  estimatedApifySavings?: number;
  estimatedDurationSavingsMs?: number;
  optimizationPercentage?: number;
}): DecisionAnalyticsSnapshot {
  const record = Object.freeze({
    decisionId: input.decisionId,
    traceId: input.traceId,
    requestId: input.requestId,
    decision: input.decision,
    winningRule: input.winningRule,
    reason: input.reason,
    force: input.force,
    feature: input.feature,
    operation: input.operation,
    decisionTimeMs: input.decisionTimeMs,
    snapshotBuildTimeMs: input.snapshotBuildTimeMs,
    snapshotCompleteness: input.snapshotCompleteness,
    estimatedApifySavings: input.estimatedApifySavings ?? 0,
    estimatedDurationSavingsMs: input.estimatedDurationSavingsMs ?? 0,
    optimizationPercentage: input.optimizationPercentage ?? 0,
    recordedAt: new Date().toISOString(),
  });

  records.push(record);
  if (records.length > MAX_RECORDS) {
    records.shift();
  }

  if (input.winningRule) {
    winningRuleCounts[input.winningRule] = (winningRuleCounts[input.winningRule] ?? 0) + 1;
  }

  for (const evaluation of input.ruleEvaluations) {
    ruleUtilization[evaluation.ruleId] = (ruleUtilization[evaluation.ruleId] ?? 0) + 1;
  }

  const snapshot = getDecisionAnalyticsSnapshot();
  logDecisionEvent("decision_analytics", snapshot as unknown as Record<string, unknown>);
  return snapshot;
}

export function getDecisionAnalyticsSnapshot(): DecisionAnalyticsSnapshot {
  const total = records.length;
  const proceedCount = records.filter((r) => r.decision === "proceed").length;
  const skipCount = records.filter((r) => r.decision === "skip").length;
  const alreadyRunningCount = records.filter((r) => r.decision === "already_running").length;
  const forceRefreshCount = records.filter((r) => r.force).length;
  const optimizationOpportunityCount = records.filter(
    (r) => r.optimizationPercentage > 0
  ).length;

  const totalDecisionTimeMs = records.reduce((sum, r) => sum + r.decisionTimeMs, 0);
  const totalSnapshotBuildTimeMs = records.reduce(
    (sum, r) => sum + r.snapshotBuildTimeMs,
    0
  );
  const totalOptimization = records.reduce((sum, r) => sum + r.optimizationPercentage, 0);
  const totalEstimatedApifySavings = records.reduce(
    (sum, r) => sum + r.estimatedApifySavings,
    0
  );
  const totalEstimatedDurationSavingsMs = records.reduce(
    (sum, r) => sum + r.estimatedDurationSavingsMs,
    0
  );

  return Object.freeze({
    totalRecords: total,
    proceedCount,
    skipCount,
    alreadyRunningCount,
    proceedRate: total === 0 ? 0 : Math.round((proceedCount / total) * 100),
    skipRate: total === 0 ? 0 : Math.round((skipCount / total) * 100),
    alreadyRunningRate:
      total === 0 ? 0 : Math.round((alreadyRunningCount / total) * 100),
    forceRefreshCount,
    averageDecisionTimeMs:
      total === 0 ? 0 : Math.round(totalDecisionTimeMs / total),
    averageSnapshotBuildTimeMs:
      total === 0 ? 0 : Math.round(totalSnapshotBuildTimeMs / total),
    averageOptimizationPercentage:
      total === 0 ? 0 : Math.round(totalOptimization / total),
    totalEstimatedApifySavings,
    totalEstimatedDurationSavingsMs,
    ruleUtilization: Object.freeze({ ...ruleUtilization }),
    winningRuleCounts: Object.freeze({ ...winningRuleCounts }),
    optimizationOpportunityCount,
  });
}

export function getRecentDecisionRecords(limit = 50): readonly DecisionAnalyticsRecord[] {
  return Object.freeze(records.slice(-limit));
}

export function resetDecisionAnalyticsForTests(): void {
  records.length = 0;
  for (const key of Object.keys(ruleUtilization)) delete ruleUtilization[key];
  for (const key of Object.keys(winningRuleCounts)) delete winningRuleCounts[key];
}
