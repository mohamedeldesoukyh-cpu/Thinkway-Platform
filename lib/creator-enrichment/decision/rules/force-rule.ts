import type { CreatorEnrichmentDecisionContext } from "../decision-context";
import { getRulePriority } from "../decision-policy";
import type { DecisionRule } from "../rule-contract";
import type { RuleEvaluation } from "../decision-types";
import type { CreatorIntelligenceSnapshot } from "../snapshot/creator-intelligence-snapshot";
import { resolveEnrichmentPolicyForRequest } from "@/lib/creator-enrichment/governance/policy/policy-engine";

const ALL_OPERATIONS = ["refresh", "enqueue", "execute", "batch"] as const;

export class ForceRule implements DecisionRule {
  readonly id = "ForceRule";
  readonly priority = getRulePriority("ForceRule");
  readonly description =
    "Bypasses downstream rules when an explicit force refresh is requested and permitted by policy.";
  readonly supportedOperations = ALL_OPERATIONS;

  evaluate(
    context: CreatorEnrichmentDecisionContext,
    _snapshot: CreatorIntelligenceSnapshot
  ): RuleEvaluation {
    if (!context.force) {
      return {
        ruleId: this.id,
        priority: this.priority,
        opinion: "no_opinion",
        executionTimeMs: 0,
      };
    }

    const policy = resolveEnrichmentPolicyForRequest({
      context,
      snapshot: _snapshot,
    });

    if (!policy.allowForceRefresh) {
      return {
        ruleId: this.id,
        priority: this.priority,
        opinion: "skip",
        reason: "force_refresh_not_permitted",
        executionTimeMs: 0,
      };
    }

    return {
      ruleId: this.id,
      priority: this.priority,
      opinion: "proceed",
      reason: "force_refresh",
      executionTimeMs: 0,
    };
  }
}
