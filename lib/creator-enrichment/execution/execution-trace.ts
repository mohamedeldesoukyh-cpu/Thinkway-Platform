import { logDecisionEvent } from "@/lib/creator-enrichment/decision/decision-logging";

import type { ExecutionPlan } from "./execution-plan-types";

export type ExecutionTrace = Readonly<{
  planId: string;
  traceId: string;
  decisionId: string;
  requestId: string;
  winningRule: string | null;
  decision: ExecutionPlan["decision"];
  decisionReason: string;
  enforcementEnabled: boolean;
  pipelineMode: ExecutionPlan["pipelineMode"];
  stages: ExecutionPlan["stages"];
  totals: ExecutionPlan["totals"];
  optimizationSummary: string;
  reusedIntelligence: ExecutionPlan["reusedIntelligence"];
  skippedStages: ExecutionPlan["skippedStages"];
  actualDurationMs: number | null;
  durationVarianceMs: number | null;
}>;

export function buildExecutionTrace(plan: ExecutionPlan): ExecutionTrace {
  const durationVarianceMs =
    plan.actualDurationMs === null
      ? null
      : plan.actualDurationMs - plan.totals.estimatedDurationMs;

  return Object.freeze({
    planId: plan.planId,
    traceId: plan.traceId,
    decisionId: plan.decisionId,
    requestId: plan.requestId,
    winningRule: plan.winningRule,
    decision: plan.decision,
    decisionReason: plan.decisionReason,
    enforcementEnabled: plan.enforcementEnabled,
    pipelineMode: plan.pipelineMode,
    stages: plan.stages,
    totals: plan.totals,
    optimizationSummary: plan.optimizationSummary,
    reusedIntelligence: plan.reusedIntelligence,
    skippedStages: plan.skippedStages,
    actualDurationMs: plan.actualDurationMs,
    durationVarianceMs,
  });
}

export function logExecutionTrace(plan: ExecutionPlan): void {
  const trace = buildExecutionTrace(plan);
  logDecisionEvent("execution_trace", trace as unknown as Record<string, unknown>);
}

export function logExecutionPlanComplete(
  plan: ExecutionPlan,
  actualDurationMs: number
): void {
  const completed = Object.freeze({
    ...buildExecutionTrace(Object.freeze({ ...plan, actualDurationMs })),
    estimatedDurationMs: plan.totals.estimatedDurationMs,
    estimatedApifyCredits: plan.totals.estimatedApifyCredits,
    estimatedSavingsApifyCredits: plan.totals.estimatedSavingsApifyCredits,
    optimizationPercentage: plan.totals.optimizationPercentage,
  });
  logDecisionEvent("execution_complete", completed as unknown as Record<string, unknown>);
}
