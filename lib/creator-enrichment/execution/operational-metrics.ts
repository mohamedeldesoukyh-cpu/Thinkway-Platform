import { logDecisionEvent } from "@/lib/creator-enrichment/decision/decision-logging";

import type { ExecutionPlan } from "./execution-plan-types";

export type ExecutionOperationalMetricsSnapshot = Readonly<{
  totalPlans: number;
  proceedPlans: number;
  skipPlans: number;
  alreadyRunningPlans: number;
  iplReuseCount: number;
  dnaReuseCount: number;
  metricsReuseCount: number;
  audienceReuseCount: number;
  avatarReuseCount: number;
  estimatedApifySavingsTotal: number;
  estimatedAiSavingsTotal: number;
  totalEstimatedDurationMs: number;
  totalActualDurationMs: number;
  executionsWithActualDuration: number;
  averageEstimatedDurationMs: number;
  averageActualDurationMs: number;
  averageOptimizationPercentage: number;
}>;

const metrics = {
  totalPlans: 0,
  proceedPlans: 0,
  skipPlans: 0,
  alreadyRunningPlans: 0,
  iplReuseCount: 0,
  dnaReuseCount: 0,
  metricsReuseCount: 0,
  audienceReuseCount: 0,
  avatarReuseCount: 0,
  estimatedApifySavingsTotal: 0,
  estimatedAiSavingsTotal: 0,
  totalEstimatedDurationMs: 0,
  totalActualDurationMs: 0,
  executionsWithActualDuration: 0,
  totalOptimizationPercentage: 0,
};

function countStageReuse(plan: ExecutionPlan, stage: string, counter: keyof typeof metrics): void {
  const match = plan.stages.find((s) => s.stage === stage && s.action === "reuse");
  if (match) {
    (metrics[counter] as number) += 1;
  }
}

export function recordExecutionPlanMetrics(plan: ExecutionPlan): ExecutionOperationalMetricsSnapshot {
  metrics.totalPlans += 1;
  metrics.totalEstimatedDurationMs += plan.totals.estimatedDurationMs;
  metrics.totalOptimizationPercentage += plan.totals.optimizationPercentage;
  metrics.estimatedApifySavingsTotal += plan.totals.estimatedSavingsApifyCredits;
  metrics.estimatedAiSavingsTotal += plan.totals.estimatedSavingsAiUnits;

  switch (plan.decision) {
    case "proceed":
      metrics.proceedPlans += 1;
      break;
    case "skip":
      metrics.skipPlans += 1;
      break;
    case "already_running":
      metrics.alreadyRunningPlans += 1;
      break;
  }

  countStageReuse(plan, "ipl", "iplReuseCount");
  countStageReuse(plan, "creatorDna", "dnaReuseCount");
  countStageReuse(plan, "metrics", "metricsReuseCount");
  countStageReuse(plan, "audience", "audienceReuseCount");
  countStageReuse(plan, "avatar", "avatarReuseCount");

  const snapshot = getExecutionOperationalMetricsSnapshot();
  logDecisionEvent("execution_operational_metrics", snapshot as unknown as Record<string, unknown>);
  return snapshot;
}

export function recordExecutionActualDuration(
  plan: ExecutionPlan,
  actualDurationMs: number
): void {
  metrics.totalActualDurationMs += actualDurationMs;
  metrics.executionsWithActualDuration += 1;
  logDecisionEvent("execution_duration", {
    planId: plan.planId,
    requestId: plan.requestId,
    estimatedDurationMs: plan.totals.estimatedDurationMs,
    actualDurationMs,
    varianceMs: actualDurationMs - plan.totals.estimatedDurationMs,
    optimizationPercentage: plan.totals.optimizationPercentage,
  });
}

/** @deprecated Use recordExecutionPlanMetrics + recordExecutionActualDuration */
export function recordExecutionOperationalMetrics(
  plan: ExecutionPlan,
  actualDurationMs?: number | null
): ExecutionOperationalMetricsSnapshot {
  const snapshot = recordExecutionPlanMetrics(plan);
  if (actualDurationMs !== undefined && actualDurationMs !== null) {
    recordExecutionActualDuration(plan, actualDurationMs);
  }
  return snapshot;
}

export function getExecutionOperationalMetricsSnapshot(): ExecutionOperationalMetricsSnapshot {
  const total = metrics.totalPlans;
  const withActual = metrics.executionsWithActualDuration;

  return Object.freeze({
    totalPlans: total,
    proceedPlans: metrics.proceedPlans,
    skipPlans: metrics.skipPlans,
    alreadyRunningPlans: metrics.alreadyRunningPlans,
    iplReuseCount: metrics.iplReuseCount,
    dnaReuseCount: metrics.dnaReuseCount,
    metricsReuseCount: metrics.metricsReuseCount,
    audienceReuseCount: metrics.audienceReuseCount,
    avatarReuseCount: metrics.avatarReuseCount,
    estimatedApifySavingsTotal: metrics.estimatedApifySavingsTotal,
    estimatedAiSavingsTotal: metrics.estimatedAiSavingsTotal,
    totalEstimatedDurationMs: metrics.totalEstimatedDurationMs,
    totalActualDurationMs: metrics.totalActualDurationMs,
    executionsWithActualDuration: withActual,
    averageEstimatedDurationMs:
      total === 0 ? 0 : Math.round(metrics.totalEstimatedDurationMs / total),
    averageActualDurationMs:
      withActual === 0 ? 0 : Math.round(metrics.totalActualDurationMs / withActual),
    averageOptimizationPercentage:
      total === 0 ? 0 : Math.round(metrics.totalOptimizationPercentage / total),
  });
}

export function resetExecutionOperationalMetricsForTests(): void {
  metrics.totalPlans = 0;
  metrics.proceedPlans = 0;
  metrics.skipPlans = 0;
  metrics.alreadyRunningPlans = 0;
  metrics.iplReuseCount = 0;
  metrics.dnaReuseCount = 0;
  metrics.metricsReuseCount = 0;
  metrics.audienceReuseCount = 0;
  metrics.avatarReuseCount = 0;
  metrics.estimatedApifySavingsTotal = 0;
  metrics.estimatedAiSavingsTotal = 0;
  metrics.totalEstimatedDurationMs = 0;
  metrics.totalActualDurationMs = 0;
  metrics.executionsWithActualDuration = 0;
  metrics.totalOptimizationPercentage = 0;
}
