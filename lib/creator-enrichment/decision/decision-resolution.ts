import type { DecisionOutcome, RuleEvaluation } from "./decision-types";
import { isDecisiveOpinion } from "./rule-contract";
import { getEffectiveRulePriority } from "@/lib/creator-enrichment/governance/rules/rule-management";

/** First decisive rule in priority order wins. */
export function resolveDecisionOutcome(
  ruleEvaluations: readonly RuleEvaluation[]
): {
  decision: DecisionOutcome;
  reason: string;
  winningRule: string | null;
} {
  const decisive = ruleEvaluations.find((evaluation) => isDecisiveOpinion(evaluation.opinion));
  if (!decisive) {
    return {
      decision: "proceed",
      reason: "All rules returned no opinion; proceeding to existing implementation.",
      winningRule: null,
    };
  }

  switch (decisive.opinion) {
    case "skip":
      return {
        decision: "skip",
        reason: decisive.reason ?? "skipped",
        winningRule: decisive.ruleId,
      };
    case "already_running":
      return {
        decision: "already_running",
        reason: decisive.reason ?? "already_running",
        winningRule: decisive.ruleId,
      };
    case "proceed":
      return {
        decision: "proceed",
        reason: decisive.reason ?? "proceed",
        winningRule: decisive.ruleId,
      };
    case "defer":
      return {
        decision: "proceed",
        reason: decisive.reason ?? "deferred",
        winningRule: decisive.ruleId,
      };
    default:
      return {
        decision: "proceed",
        reason: "All rules returned no opinion; proceeding to existing implementation.",
        winningRule: null,
      };
  }
}

export function evaluateRulesInPriorityOrder(input: {
  rules: readonly import("./rule-contract").DecisionRule[];
  context: import("./decision-context").CreatorEnrichmentDecisionContext;
  snapshot: import("./snapshot/creator-intelligence-snapshot").CreatorIntelligenceSnapshot;
}): RuleEvaluation[] {
  const evaluations: RuleEvaluation[] = [];

  for (const rule of input.rules) {
    const startedAt = Date.now();
    const evaluation = rule.evaluate(input.context, input.snapshot);
    const executionTimeMs = Date.now() - startedAt;
    const effectivePriority = getEffectiveRulePriority(rule.id, rule.priority);
    const timed: RuleEvaluation = {
      ...evaluation,
      priority: effectivePriority >= 0 ? effectivePriority : evaluation.priority ?? rule.priority,
      executionTimeMs,
    };
    evaluations.push(timed);

    if (isDecisiveOpinion(timed.opinion)) {
      break;
    }
  }

  return evaluations;
}
