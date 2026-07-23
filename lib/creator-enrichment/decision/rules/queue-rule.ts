import type { CreatorEnrichmentDecisionContext } from "../decision-context";
import { getRulePriority } from "../decision-policy";
import type { DecisionRule } from "../rule-contract";
import type { RuleEvaluation } from "../decision-types";
import type { CreatorIntelligenceSnapshot } from "../snapshot/creator-intelligence-snapshot";
import type { SnapshotQueueStatus } from "../snapshot/snapshot-types";

const QUEUED_OPERATIONS = ["refresh", "enqueue", "execute"] as const;

function isInflight(snapshot: CreatorIntelligenceSnapshot): boolean {
  if (snapshot.enrichmentRunning === true) return true;
  return isQueuedOrRunningStatus(snapshot.queueStatus);
}

function isQueuedOrRunningStatus(status: SnapshotQueueStatus): boolean {
  return status === "queued" || status === "running";
}

/** Uses snapshot queue signals only — no BullMQ or database access. */
export class QueueRule implements DecisionRule {
  readonly id = "QueueRule";
  readonly priority = getRulePriority("QueueRule");
  readonly description =
    "Prevents duplicate work when enrichment is already queued or running.";
  readonly supportedOperations = QUEUED_OPERATIONS;

  evaluate(
    _context: CreatorEnrichmentDecisionContext,
    snapshot: CreatorIntelligenceSnapshot
  ): RuleEvaluation {
    if (!isInflight(snapshot)) {
      return {
        ruleId: this.id,
        priority: this.priority,
        opinion: "no_opinion",
        executionTimeMs: 0,
      };
    }

    return {
      ruleId: this.id,
      priority: this.priority,
      opinion: "already_running",
      reason: "enrichment_already_in_progress",
      executionTimeMs: 0,
    };
  }
}
