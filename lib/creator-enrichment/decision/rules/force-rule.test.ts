import assert from "node:assert/strict";

import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";
import { ForceRule } from "@/lib/creator-enrichment/decision/rules/force-rule";
import { createEmptyCreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/creator-intelligence-snapshot";
import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

function context(overrides: Partial<CreatorEnrichmentDecisionContext> = {}): CreatorEnrichmentDecisionContext {
  return Object.freeze({
    requestId: "req-1",
    feature: "manual_refresh",
    trigger: "manual",
    priority: 4,
    creatorId: "creator-1",
    platformAccountId: null,
    force: true,
    scope: "metrics",
    requestedBy: null,
    timestamp: new Date().toISOString(),
    operation: "refresh",
    delegatedTo: "refreshCreatorMetrics",
    supabase: null,
    ...overrides,
  });
}

function snapshot(): CreatorIntelligenceSnapshot {
  return Object.freeze({
    ...createEmptyCreatorIntelligenceSnapshot(),
    creatorId: "creator-1",
    influencerId: "creator-1",
    metadata: Object.freeze({ ...createEmptyCreatorIntelligenceSnapshot().metadata }),
  });
}

function testForceProceeds() {
  const rule = new ForceRule();
  const evaluation = rule.evaluate(context({ force: true }), snapshot());
  assert.equal(evaluation.opinion, "proceed");
  assert.equal(evaluation.reason, "force_refresh");
  assert.equal(evaluation.priority, 500);
}

function testNotForcedNoOpinion() {
  const rule = new ForceRule();
  const evaluation = rule.evaluate(context({ force: false }), snapshot());
  assert.equal(evaluation.opinion, "no_opinion");
}

function run() {
  testForceProceeds();
  testNotForcedNoOpinion();
  console.log("force-rule.test.ts: all tests passed");
}

run();
