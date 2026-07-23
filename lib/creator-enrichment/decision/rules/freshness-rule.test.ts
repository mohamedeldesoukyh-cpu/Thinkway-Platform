import assert from "node:assert/strict";

import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";
import { FreshnessRule } from "@/lib/creator-enrichment/decision/rules/freshness-rule";
import { createEmptyCreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/creator-intelligence-snapshot";
import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

function context(): CreatorEnrichmentDecisionContext {
  return Object.freeze({
    requestId: "req-1",
    feature: "manual_refresh",
    trigger: "manual",
    priority: 4,
    creatorId: "creator-1",
    platformAccountId: null,
    force: false,
    scope: "metrics",
    requestedBy: null,
    timestamp: new Date().toISOString(),
    operation: "refresh",
    delegatedTo: "refreshCreatorMetrics",
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
    lastSuccessfulEnrichment: "2026-07-18T00:00:00.000Z",
    ...overrides,
    metadata: Object.freeze({
      ...createEmptyCreatorIntelligenceSnapshot().metadata,
      ...(overrides.metadata ?? {}),
    }),
  });
}

function testFreshSkips() {
  const rule = new FreshnessRule();
  const evaluation = rule.evaluate(context(), snapshot({ metricsFreshness: "fresh" }));
  assert.equal(evaluation.opinion, "skip");
  assert.equal(evaluation.reason, "creator_already_fresh");
}

function testStaleProceeds() {
  const rule = new FreshnessRule();
  const evaluation = rule.evaluate(
    context(),
    snapshot({
      metricsFreshness: "stale",
      lastSuccessfulEnrichment: "2026-01-01T00:00:00.000Z",
    })
  );
  assert.equal(evaluation.opinion, "proceed");
  assert.equal(evaluation.reason, "creator_stale");
}

function testUnknownFreshnessProceeds() {
  const rule = new FreshnessRule();
  const evaluation = rule.evaluate(
    context(),
    snapshot({
      metricsFreshness: null,
      lastSuccessfulEnrichment: null,
    })
  );
  assert.equal(evaluation.opinion, "proceed");
  assert.equal(evaluation.reason, "creator_stale");
}

function run() {
  testFreshSkips();
  testStaleProceeds();
  testUnknownFreshnessProceeds();
  console.log("freshness-rule.test.ts: all tests passed");
}

run();
