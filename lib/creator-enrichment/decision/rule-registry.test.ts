import assert from "node:assert/strict";

import {
  evaluateRulesInPriorityOrder,
  resolveDecisionOutcome,
} from "@/lib/creator-enrichment/decision/decision-resolution";
import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";
import {
  createDefaultRuleRegistry,
  DecisionRuleRegistry,
} from "@/lib/creator-enrichment/decision/rule-registry";
import { ForceRule } from "@/lib/creator-enrichment/decision/rules/force-rule";
import { FreshnessRule } from "@/lib/creator-enrichment/decision/rules/freshness-rule";
import { QueueRule } from "@/lib/creator-enrichment/decision/rules/queue-rule";
import { createEmptyCreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/creator-intelligence-snapshot";

function context(force: boolean): CreatorEnrichmentDecisionContext {
  return Object.freeze({
    requestId: "req-1",
    feature: "manual_refresh",
    trigger: "manual",
    priority: 4,
    creatorId: "creator-1",
    platformAccountId: null,
    force,
    scope: "metrics",
    requestedBy: null,
    timestamp: new Date().toISOString(),
    operation: "refresh",
    delegatedTo: "refreshCreatorMetrics",
    supabase: null,
  });
}

function testRegistryOrdersByPriority() {
  const registry = createDefaultRuleRegistry();
  const ordered = registry.getOrderedRules("refresh");
  assert.equal(ordered[0]?.id, "ForceRule");
  assert.equal(ordered[1]?.id, "QueueRule");
  assert.equal(ordered[2]?.id, "FreshnessRule");
}

function testForceWinsBeforeFreshness() {
  const registry = new DecisionRuleRegistry()
    .register(new ForceRule())
    .register(new FreshnessRule());
  const snapshot = Object.freeze({
    ...createEmptyCreatorIntelligenceSnapshot(),
    metricsFreshness: "fresh" as const,
    metadata: Object.freeze({ ...createEmptyCreatorIntelligenceSnapshot().metadata }),
  });
  const evaluations = evaluateRulesInPriorityOrder({
    rules: registry.getOrderedRules("refresh"),
    context: context(true),
    snapshot,
  });
  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0]?.ruleId, "ForceRule");
  const resolved = resolveDecisionOutcome(evaluations);
  assert.equal(resolved.decision, "proceed");
  assert.equal(resolved.reason, "force_refresh");
}

function testQueueWinsBeforeFreshness() {
  const registry = new DecisionRuleRegistry()
    .register(new QueueRule())
    .register(new FreshnessRule());
  const snapshot = Object.freeze({
    ...createEmptyCreatorIntelligenceSnapshot(),
    enrichmentRunning: true,
    queueStatus: "running" as const,
    metricsFreshness: "fresh" as const,
    metadata: Object.freeze({ ...createEmptyCreatorIntelligenceSnapshot().metadata }),
  });
  const evaluations = evaluateRulesInPriorityOrder({
    rules: registry.getOrderedRules("refresh"),
    context: context(false),
    snapshot,
  });
  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0]?.ruleId, "QueueRule");
  const resolved = resolveDecisionOutcome(evaluations);
  assert.equal(resolved.decision, "already_running");
}

function testFreshnessSkipsWhenNotForcedOrQueued() {
  const registry = new DecisionRuleRegistry()
    .register(new ForceRule())
    .register(new QueueRule())
    .register(new FreshnessRule());
  const snapshot = Object.freeze({
    ...createEmptyCreatorIntelligenceSnapshot(),
    enrichmentRunning: false,
    queueStatus: "idle" as const,
    metricsFreshness: "fresh" as const,
    metadata: Object.freeze({ ...createEmptyCreatorIntelligenceSnapshot().metadata }),
  });
  const evaluations = evaluateRulesInPriorityOrder({
    rules: registry.getOrderedRules("refresh"),
    context: context(false),
    snapshot,
  });
  assert.equal(evaluations.length, 3);
  assert.equal(evaluations[2]?.ruleId, "FreshnessRule");
  const resolved = resolveDecisionOutcome(evaluations);
  assert.equal(resolved.decision, "skip");
  assert.equal(resolved.winningRule, "FreshnessRule");
}

function run() {
  testRegistryOrdersByPriority();
  testForceWinsBeforeFreshness();
  testQueueWinsBeforeFreshness();
  testFreshnessSkipsWhenNotForcedOrQueued();
  console.log("rule-registry.test.ts: all tests passed");
}

run();
