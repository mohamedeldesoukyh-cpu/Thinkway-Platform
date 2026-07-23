import { randomUUID } from "node:crypto";

import type { DecisionOutcome, RuleEvaluation } from "./decision-types";
import { logDecisionEvent } from "./decision-logging";

export type DecisionTraceRuleEntry = Readonly<{
  rule: string;
  priority: number;
  opinion: RuleEvaluation["opinion"];
  reason?: string;
  executionTimeMs: number;
}>;

export type DecisionTrace = Readonly<{
  decisionId: string;
  traceId: string;
  decision: DecisionOutcome;
  winningRule: string | null;
  reason: string;
  snapshotVersion: string;
  snapshotCompleteness: number;
  decisionTimeMs: number;
  snapshotBuildTimeMs: number;
  rules: readonly DecisionTraceRuleEntry[];
}>;

export function buildDecisionTrace(input: {
  decisionId: string;
  decision: DecisionOutcome;
  winningRule: string | null;
  reason: string;
  snapshotVersion: string;
  snapshotCompleteness: number;
  decisionTimeMs: number;
  snapshotBuildTimeMs: number;
  ruleEvaluations: readonly RuleEvaluation[];
}): DecisionTrace {
  return Object.freeze({
    decisionId: input.decisionId,
    traceId: randomUUID(),
    decision: input.decision,
    winningRule: input.winningRule,
    reason: input.reason,
    snapshotVersion: input.snapshotVersion,
    snapshotCompleteness: input.snapshotCompleteness,
    decisionTimeMs: input.decisionTimeMs,
    snapshotBuildTimeMs: input.snapshotBuildTimeMs,
    rules: Object.freeze(
      input.ruleEvaluations.map((evaluation) =>
        Object.freeze({
          rule: evaluation.ruleId,
          priority: evaluation.priority,
          opinion: evaluation.opinion,
          reason: evaluation.reason,
          executionTimeMs: evaluation.executionTimeMs,
        })
      )
    ),
  });
}

export function logDecisionTrace(trace: DecisionTrace): void {
  logDecisionEvent("decision_trace", trace as unknown as Record<string, unknown>);
}

export function buildRuleExecutionSummary(
  ruleEvaluations: readonly RuleEvaluation[]
): Readonly<Record<string, number>> {
  const summary: Record<string, number> = {};
  for (const evaluation of ruleEvaluations) {
    summary[evaluation.opinion] = (summary[evaluation.opinion] ?? 0) + 1;
  }
  return Object.freeze(summary);
}
