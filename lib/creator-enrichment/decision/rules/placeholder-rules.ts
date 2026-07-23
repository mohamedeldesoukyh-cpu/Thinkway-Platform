import type { CreatorEnrichmentDecisionContext } from "../decision-context";
import { getRulePriority, type DecisionRuleId } from "../decision-policy";
import type { DecisionRule } from "../rule-contract";
import type { RuleEvaluation } from "../decision-types";
import type { CreatorIntelligenceSnapshot } from "../snapshot/creator-intelligence-snapshot";

const ALL_OPERATIONS = ["refresh", "enqueue", "execute", "batch"] as const;

function placeholderRule(
  id: DecisionRuleId,
  description: string
): DecisionRule {
  const priority = getRulePriority(id);
  return {
    id,
    priority,
    description,
    supportedOperations: ALL_OPERATIONS,
    evaluate(
      _context: CreatorEnrichmentDecisionContext,
      _snapshot: CreatorIntelligenceSnapshot
    ): RuleEvaluation {
      return {
        ruleId: id,
        priority,
        opinion: "no_opinion",
        executionTimeMs: 0,
      };
    },
  };
}

export const iplRule = placeholderRule(
  "IPLRule",
  "Placeholder — IPL reuse decisions deferred to Phase 3."
);

export const dnaRule = placeholderRule(
  "DNARule",
  "Placeholder — Creator DNA reuse decisions deferred to Phase 3."
);

export const cacheRule = placeholderRule(
  "CacheRule",
  "Placeholder — cache reuse decisions deferred to Phase 3."
);

export const costRule = placeholderRule(
  "CostRule",
  "Placeholder — cost/credit optimization deferred to Phase 3."
);
