import type { CreatorEnrichmentDecisionContext } from "./decision-context";
import type { DecisionOperation, RuleEvaluation } from "./decision-types";
import type { CreatorIntelligenceSnapshot } from "./snapshot/creator-intelligence-snapshot";

/**
 * Contract every decision rule must implement.
 * Future rules plug in via the registry — no Decision Engine changes required.
 */
export type DecisionRule = Readonly<{
  id: string;
  priority: number;
  description: string;
  supportedOperations: readonly DecisionOperation[];
  evaluate(
    context: CreatorEnrichmentDecisionContext,
    snapshot: CreatorIntelligenceSnapshot
  ): RuleEvaluation;
}>;

export function isDecisiveOpinion(opinion: RuleEvaluation["opinion"]): boolean {
  return opinion !== "no_opinion";
}

export function ruleSupportsOperation(
  rule: DecisionRule,
  operation: DecisionOperation
): boolean {
  return rule.supportedOperations.includes(operation);
}
