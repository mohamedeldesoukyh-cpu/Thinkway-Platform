import type { CreatorEnrichmentDecisionContext } from "./decision-context";
import { recordDecisionMetrics } from "./decision-metrics";
import { logDecisionEvent } from "./decision-logging";
import {
  createDecisionFromRuleEvaluations,
  type CreatorEnrichmentDecisionOutcome,
} from "./decision-result";
import { evaluateRulesInPriorityOrder } from "./decision-resolution";
import { buildDecisionTrace, logDecisionTrace } from "./decision-trace";
import {
  getDefaultRuleRegistry,
  type DecisionRuleRegistry,
} from "./rule-registry";
import { computeSnapshotCompleteness } from "./snapshot/snapshot-completeness";
import { buildCreatorIntelligenceSnapshot } from "./snapshot/snapshot-builder";
import {
  getDefaultSnapshotProvider,
  type CreatorIntelligenceSnapshotProvider,
} from "./snapshot/snapshot-provider";
import { readSnapshotVersion } from "./snapshot/snapshot-version";

/**
 * Centralized decision engine — evaluates registry rules in priority order.
 * Phase 2.4: feature-complete decision platform with trace and metrics.
 */
export class CreatorEnrichmentDecisionEngine {
  constructor(
    private readonly registry: DecisionRuleRegistry = getDefaultRuleRegistry(),
    private readonly snapshotProvider: CreatorIntelligenceSnapshotProvider = getDefaultSnapshotProvider()
  ) {}

  async decide(
    context: CreatorEnrichmentDecisionContext
  ): Promise<CreatorEnrichmentDecisionOutcome> {
    logDecisionEvent("decision_started", {
      requestId: context.requestId,
      feature: context.feature,
      trigger: context.trigger,
      operation: context.operation,
      creatorId: context.creatorId,
      delegatedTo: context.delegatedTo,
      force: context.force,
    });

    const snapshotStartedAt = Date.now();
    const snapshot = await buildCreatorIntelligenceSnapshot(context, this.snapshotProvider);
    const snapshotBuildTimeMs = Date.now() - snapshotStartedAt;
    const completeness = computeSnapshotCompleteness(snapshot);
    const snapshotVersion = readSnapshotVersion(snapshot);
    const dataSourcesUsed = Array.isArray(snapshot.metadata.dataSourcesUsed)
      ? snapshot.metadata.dataSourcesUsed
      : [];

    const rulesStartedAt = Date.now();
    const orderedRules = this.registry.getOrderedRules(context.operation);
    const ruleEvaluations = evaluateRulesInPriorityOrder({
      rules: orderedRules,
      context,
      snapshot,
    });
    const rulesEvalMs = Date.now() - rulesStartedAt;
    const decisionTimeMs = snapshotBuildTimeMs + rulesEvalMs;

    const result = createDecisionFromRuleEvaluations({
      delegate: context.delegatedTo,
      decisionTimeMs,
      snapshotBuildTimeMs,
      snapshotVersion,
      snapshot,
      ruleEvaluations,
    });

    const trace = buildDecisionTrace({
      decisionId: result.decisionId,
      decision: result.decision,
      winningRule: result.winningRule,
      reason: result.reason,
      snapshotVersion,
      snapshotCompleteness: completeness.snapshotCompleteness,
      decisionTimeMs: result.decisionTimeMs,
      snapshotBuildTimeMs,
      ruleEvaluations,
    });
    logDecisionTrace(trace);

    recordDecisionMetrics({
      decision: result.decision,
      decisionTimeMs: result.decisionTimeMs,
      snapshotBuildTimeMs,
      force: context.force,
      winningRule: result.winningRule,
    });

    logDecisionEvent("decision_complete", {
      requestId: context.requestId,
      decisionId: result.decisionId,
      traceId: result.traceId,
      decision: result.decision,
      delegate: result.delegate,
      reason: result.reason,
      winningRule: result.winningRule,
      decidingRuleId: result.decidingRuleId,
      ruleCount: ruleEvaluations.length,
      decisionTimeMs: result.decisionTimeMs,
      snapshotBuildTimeMs: result.snapshotBuildTimeMs,
      decisionTime: result.decisionTime,
      snapshotVersion,
      snapshotCreatorId: snapshot.creatorId,
      snapshotCompleteness: completeness.snapshotCompleteness,
      populatedFields: completeness.populatedFields,
      dataSourcesUsed,
      metricsFreshness: snapshot.metricsFreshness,
      force: context.force,
      lastSuccessfulEnrichment: snapshot.lastSuccessfulEnrichment,
      ruleExecutionSummary: result.ruleExecutionSummary,
    });

    return result;
  }
}

let singleton: CreatorEnrichmentDecisionEngine | null = null;

export function getCreatorEnrichmentDecisionEngine(): CreatorEnrichmentDecisionEngine {
  if (!singleton) {
    singleton = new CreatorEnrichmentDecisionEngine();
  }
  return singleton;
}

/** Test helper — reset singleton between tests. */
export function resetCreatorEnrichmentDecisionEngineForTests(): void {
  singleton = null;
}
