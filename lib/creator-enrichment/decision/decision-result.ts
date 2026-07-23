import { randomUUID } from "node:crypto";

import type { CreatorIntelligenceSnapshot } from "./snapshot/snapshot-types";
import type { DecisionOutcome, RuleEvaluation } from "./decision-types";
import { resolveDecisionOutcome } from "./decision-resolution";
import {
  buildRuleExecutionSummary,
  type DecisionTraceRuleEntry,
} from "./decision-trace";

/** Result of a decision engine evaluation. */
export type CreatorEnrichmentDecisionResult = Readonly<{
  decision: DecisionOutcome;
  delegate: string;
  reason: string;
  decisionId: string;
  traceId: string;
  decisionTime: string;
  decisionTimeMs: number;
  snapshotBuildTimeMs: number;
  snapshotVersion: string;
  winningRule: string | null;
  /** @deprecated Use winningRule */
  decidingRuleId: string | null;
  ruleEvaluations: readonly RuleEvaluation[];
  evaluatedRules: readonly DecisionTraceRuleEntry[];
  ruleExecutionSummary: Readonly<Record<string, number>>;
}>;

/** Internal orchestrator surface — snapshot attached to avoid duplicate I/O. */
export type CreatorEnrichmentDecisionOutcome = CreatorEnrichmentDecisionResult &
  Readonly<{
    snapshot: CreatorIntelligenceSnapshot;
  }>;

function createDecisionResult(input: {
  decision: DecisionOutcome;
  delegate: string;
  reason: string;
  decisionTimeMs: number;
  snapshotBuildTimeMs: number;
  snapshotVersion: string;
  ruleEvaluations: readonly RuleEvaluation[];
  winningRule: string | null;
}): CreatorEnrichmentDecisionResult {
  const decisionId = randomUUID();
  const traceId = randomUUID();
  const evaluatedRules = Object.freeze(
    input.ruleEvaluations.map((evaluation) =>
      Object.freeze({
        rule: evaluation.ruleId,
        priority: evaluation.priority,
        opinion: evaluation.opinion,
        reason: evaluation.reason,
        executionTimeMs: evaluation.executionTimeMs,
      })
    )
  );

  return Object.freeze({
    decision: input.decision,
    delegate: input.delegate,
    reason: input.reason,
    decisionId,
    traceId,
    decisionTime: new Date().toISOString(),
    decisionTimeMs: input.decisionTimeMs,
    snapshotBuildTimeMs: input.snapshotBuildTimeMs,
    snapshotVersion: input.snapshotVersion,
    winningRule: input.winningRule,
    decidingRuleId: input.winningRule,
    ruleEvaluations: Object.freeze([...input.ruleEvaluations]),
    evaluatedRules,
    ruleExecutionSummary: buildRuleExecutionSummary(input.ruleEvaluations),
  });
}

export function createProceedDecision(input: {
  delegate: string;
  reason: string;
  decisionTimeMs: number;
  snapshotBuildTimeMs?: number;
  snapshotVersion?: string;
  ruleEvaluations: readonly RuleEvaluation[];
  winningRule?: string | null;
}): CreatorEnrichmentDecisionResult {
  return createDecisionResult({
    decision: "proceed",
    delegate: input.delegate,
    reason: input.reason,
    decisionTimeMs: input.decisionTimeMs,
    snapshotBuildTimeMs: input.snapshotBuildTimeMs ?? 0,
    snapshotVersion: input.snapshotVersion ?? "unknown",
    ruleEvaluations: input.ruleEvaluations,
    winningRule: input.winningRule ?? null,
  });
}

export function createDecisionFromRuleEvaluations(input: {
  delegate: string;
  decisionTimeMs: number;
  snapshotBuildTimeMs: number;
  snapshotVersion: string;
  snapshot: CreatorIntelligenceSnapshot;
  ruleEvaluations: readonly RuleEvaluation[];
}): CreatorEnrichmentDecisionOutcome {
  const resolved = resolveDecisionOutcome(input.ruleEvaluations);
  const result = createDecisionResult({
    decision: resolved.decision,
    delegate: input.delegate,
    reason: resolved.reason,
    decisionTimeMs: input.decisionTimeMs,
    snapshotBuildTimeMs: input.snapshotBuildTimeMs,
    snapshotVersion: input.snapshotVersion,
    ruleEvaluations: input.ruleEvaluations,
    winningRule: resolved.winningRule,
  });
  return Object.freeze({
    ...result,
    snapshot: input.snapshot,
  });
}
