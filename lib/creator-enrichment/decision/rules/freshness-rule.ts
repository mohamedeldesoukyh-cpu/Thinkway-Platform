import type { CreatorEnrichmentDecisionContext } from "../decision-context";
import { getRulePriority } from "../decision-policy";
import type { DecisionRule } from "../rule-contract";
import type { RuleEvaluation } from "../decision-types";
import type { CreatorIntelligenceSnapshot } from "../snapshot/creator-intelligence-snapshot";
import {
  isMetricsFreshForPolicy,
  resolveEnrichmentPolicyForRequest,
} from "@/lib/creator-enrichment/governance/policy/policy-engine";

const ALL_OPERATIONS = ["refresh", "enqueue", "execute", "batch"] as const;

/** Skips enrichment when snapshot metrics are within the resolved policy freshness window. */
export class FreshnessRule implements DecisionRule {
  readonly id = "FreshnessRule";
  readonly priority = getRulePriority("FreshnessRule");
  readonly description =
    "Skips enrichment when creator metrics are within the configured policy freshness window.";
  readonly supportedOperations = ALL_OPERATIONS;

  evaluate(
    context: CreatorEnrichmentDecisionContext,
    snapshot: CreatorIntelligenceSnapshot
  ): RuleEvaluation {
    const policy = resolveEnrichmentPolicyForRequest({ context, snapshot });
    const fresh = isMetricsFreshForPolicy(
      snapshot.lastSuccessfulEnrichment,
      policy.freshnessWindowDays
    );

    if (fresh) {
      return {
        ruleId: this.id,
        priority: this.priority,
        opinion: "skip",
        reason: "creator_already_fresh",
        executionTimeMs: 0,
      };
    }

    return {
      ruleId: this.id,
      priority: this.priority,
      opinion: "proceed",
      reason: "creator_stale",
      executionTimeMs: 0,
    };
  }
}
