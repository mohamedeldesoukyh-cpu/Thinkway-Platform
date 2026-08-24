import assert from "node:assert/strict";

import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";
import { QueueRule } from "@/lib/creator-enrichment/decision/rules/queue-rule";
import { createEmptyCreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/creator-intelligence-snapshot";
import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

function context(): CreatorEnrichmentDecisionContext {
  return Object.freeze({
    requestId: "req-1",
    feature: "shortlist",
    trigger: "shortlist",
    priority: 2,
    creatorId: "creator-1",
    platformAccountId: null,
    force: false,
    scope: "all",
    requestedBy: null,
    timestamp: new Date().toISOString(),
    operation: "enqueue",
    delegatedTo: "enqueueCreatorEnrichment",
    supabase: null,
  });
}

function snapshot(
  overrides: Partial<CreatorIntelligenceSnapshot> = {}
): CreatorIntelligenceSnapshot {
  return Object.freeze({
    ...createEmptyCreatorIntelligenceSnapshot(),
    creatorId: "creator-1",
    influencerId: "creator-1",
    ...overrides,
    metadata: Object.freeze({
      ...createEmptyCreatorIntelligenceSnapshot().metadata,
      ...(overrides.metadata ?? {}),
    }),
  });
}

function testIdleNoOpinion() {
  const rule = new QueueRule();
  const evaluation = rule.evaluate(
    context(),
    snapshot({ enrichmentRunning: false, queueStatus: "idle" })
  );
  assert.equal(evaluation.opinion, "no_opinion");
}

function testRunningAlreadyRunning() {
  const rule = new QueueRule();
  const evaluation = rule.evaluate(
    context(),
    snapshot({ enrichmentRunning: true, queueStatus: "running" })
  );
  assert.equal(evaluation.opinion, "already_running");
  assert.equal(evaluation.reason, "enrichment_already_in_progress");
}

function testQueuedStatusAlreadyRunning() {
  const rule = new QueueRule();
  const evaluation = rule.evaluate(
    context(),
    snapshot({ enrichmentRunning: false, queueStatus: "queued" })
  );
  assert.equal(evaluation.opinion, "already_running");
}

function testExecuteIsNotGuarded() {
  const rule = new QueueRule();
  assert.equal(rule.supportedOperations.includes("execute"), false);
}

function run() {
  testIdleNoOpinion();
  testRunningAlreadyRunning();
  testQueuedStatusAlreadyRunning();
  testExecuteIsNotGuarded();
  console.log("queue-rule.test.ts: all tests passed");
}

run();
