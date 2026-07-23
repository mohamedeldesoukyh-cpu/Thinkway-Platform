import { randomUUID } from "node:crypto";

import type { CreatorEnrichmentDecisionResult } from "@/lib/creator-enrichment/decision/decision-result";
import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

import type {
  BuildExecutionPlanInput,
  ExecutionPlan,
  ExecutionStageId,
  ExecutionStagePlan,
} from "./execution-plan-types";
import { computePlanTotals, enrichStageDecisions } from "./plan-estimation";
import { planStages, planStagesForShortCircuit } from "./stage-planner";

/** Partial stage execution is not safe until pipeline is modularized — see compatibility report. */
export const PIPELINE_ENFORCEMENT_ENABLED = false;

export const PIPELINE_ENFORCEMENT_DISABLED_REASON =
  "runCreatorEnrichment executes a monolithic per-platform loop; scope filters IPA writes only. " +
  "IPL fetch, avatar persist, and DNA bridge run unconditionally. Stage-level skip/reuse cannot be enforced safely.";

function buildOptimizationSummary(
  stages: readonly ExecutionStagePlan[],
  decision: CreatorEnrichmentDecisionResult["decision"]
): string {
  if (decision !== "proceed") {
    return `No enrichment stages executed — decision=${decision}.`;
  }

  const reuse = stages.filter((s) => s.action === "reuse").map((s) => s.stage);
  const run = stages.filter((s) => s.action === "run").map((s) => s.stage);
  const skip = stages.filter((s) => s.action === "skip").map((s) => s.stage);

  const parts: string[] = [];
  if (run.length) parts.push(`run: ${run.join(", ")}`);
  if (reuse.length) parts.push(`reuse: ${reuse.join(", ")}`);
  if (skip.length) parts.push(`skip: ${skip.join(", ")}`);

  const suffix = PIPELINE_ENFORCEMENT_ENABLED
    ? "Plan enforced by pipeline."
    : "Plan advisory only — full legacy pipeline will execute.";

  return `${parts.join("; ")}. ${suffix}`;
}

function collectReusedIntelligence(stages: readonly ExecutionStagePlan[]): string[] {
  return stages
    .filter((stage) => stage.action === "reuse")
    .map((stage) => stage.stage);
}

function collectSkippedStages(stages: readonly ExecutionStagePlan[]): ExecutionStageId[] {
  return stages
    .filter((stage) => stage.action === "skip")
    .map((stage) => stage.stage);
}

/**
 * Pure execution planner — converts decision + snapshot into an immutable plan.
 * Zero I/O; does not access infrastructure.
 */
export function buildExecutionPlan(input: BuildExecutionPlanInput): ExecutionPlan {
  const { requestId, force, snapshot, decision } = input;
  const planId = randomUUID();

  const stageDecisions =
    decision.decision === "proceed"
      ? planStages(force, snapshot)
      : planStagesForShortCircuit(decision.decision, decision.reason);

  const stages = Object.freeze(enrichStageDecisions(stageDecisions));
  const totals = computePlanTotals(stages);
  const reusedIntelligence = Object.freeze(collectReusedIntelligence(stages));
  const skippedStages = Object.freeze(collectSkippedStages(stages));

  return Object.freeze({
    planId,
    traceId: decision.traceId,
    decisionId: decision.decisionId,
    requestId,
    winningRule: decision.winningRule,
    decision: decision.decision,
    decisionReason: decision.reason,
    snapshotVersion: decision.snapshotVersion,
    enforcementEnabled: PIPELINE_ENFORCEMENT_ENABLED,
    pipelineMode: PIPELINE_ENFORCEMENT_ENABLED ? "partial_ready" : "full_legacy",
    stages,
    totals,
    optimizationSummary: buildOptimizationSummary(stages, decision.decision),
    reusedIntelligence,
    skippedStages,
    actualDurationMs: null,
    createdAt: new Date().toISOString(),
  });
}

export function attachActualDuration(
  plan: ExecutionPlan,
  actualDurationMs: number
): ExecutionPlan {
  return Object.freeze({
    ...plan,
    actualDurationMs,
  });
}

export type ExecutionPlannerInput = Readonly<{
  requestId: string;
  force: boolean;
  snapshot: CreatorIntelligenceSnapshot;
  decision: CreatorEnrichmentDecisionResult;
}>;

export function planExecution(input: ExecutionPlannerInput): ExecutionPlan {
  return buildExecutionPlan(input);
}
