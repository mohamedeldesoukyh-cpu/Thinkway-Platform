import assert from "node:assert/strict";

import {
  FreshnessRule,
  ForceRule,
  resetDecisionPolicyForTests,
} from "@/lib/creator-enrichment/decision";
import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";
import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";
import {
  buildGovernanceReport,
  calculateIntelligenceHealthScore,
  generateRefreshRecommendations,
  getDecisionAnalyticsSnapshot,
  resetDecisionAnalyticsForTests,
  resetGovernancePolicyForTests,
  resetRuleManagementForTests,
  resolveEnrichmentPolicy,
  setGovernancePolicyForTests,
  setRuleEnabled,
  validateGovernancePolicy,
} from "@/lib/creator-enrichment/governance";

function baseContext(
  overrides: Partial<CreatorEnrichmentDecisionContext> = {}
): CreatorEnrichmentDecisionContext {
  return Object.freeze({
    requestId: "req-1",
    feature: "manual_refresh",
    trigger: "manual",
    priority: 4,
    creatorId: "creator-1",
    platformAccountId: null,
    force: false,
    scope: "all",
    requestedBy: null,
    timestamp: "2026-07-19T00:00:00.000Z",
    operation: "refresh",
    delegatedTo: "refreshCreatorMetrics",
    supabase: null,
    ...overrides,
  });
}

function baseSnapshot(
  overrides: Partial<CreatorIntelligenceSnapshot> = {}
): CreatorIntelligenceSnapshot {
  const now = Date.now();
  const recent = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
  return Object.freeze({
    creatorId: "creator-1",
    influencerId: "creator-1",
    platformAccountId: "pa-1",
    enrichmentRunning: false,
    queueStatus: "idle",
    lastEnrichment: recent,
    lastSuccessfulEnrichment: recent,
    lastManualRefresh: null,
    lastIPLFetch: recent,
    dnaStatus: "complete",
    dnaCompleteness: 82,
    metricsFreshness: "fresh",
    avatarFreshness: null,
    countryKnown: true,
    audienceKnown: true,
    hasCreatorDNA: true,
    hasIPLSnapshot: true,
    metadata: Object.freeze({
      snapshotVersion: "2.4",
      platform: "tiktok",
      creatorTier: "standard",
    }),
    ...overrides,
  });
}

async function testPolicyChangesFreshnessDecision() {
  resetGovernancePolicyForTests();
  resetDecisionPolicyForTests();
  const rule = new FreshnessRule();
  const context = baseContext();
  const snapshot = baseSnapshot();

  const tiktokPolicy = resolveEnrichmentPolicy({
    resolutionContext: Object.freeze({
      feature: "manual_refresh",
      force: false,
      requestedBy: null,
      platform: "tiktok",
      tier: "standard",
      campaignId: null,
    }),
  });
  assert.equal(tiktokPolicy.freshnessWindowDays, 21);
  assert.equal(tiktokPolicy.appliedPolicyIds.includes("platform:tiktok"), true);

  const freshEval = rule.evaluate(context, snapshot);
  assert.equal(freshEval.opinion, "skip");

  const staleSnapshot = baseSnapshot({
    lastSuccessfulEnrichment: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    metricsFreshness: "stale",
  });
  const staleEval = rule.evaluate(context, staleSnapshot);
  assert.equal(staleEval.opinion, "proceed");
  assert.equal(staleEval.reason, "creator_stale");
}

async function testForceRefreshBlockedByPolicy() {
  resetGovernancePolicyForTests();
  setGovernancePolicyForTests({ allowForceRefresh: false });
  const rule = new ForceRule();
  const evaluation = rule.evaluate(baseContext({ force: true }), baseSnapshot());
  assert.equal(evaluation.opinion, "skip");
  assert.equal(evaluation.reason, "force_refresh_not_permitted");
}

async function testHealthScoreAndRecommendations() {
  resetGovernancePolicyForTests();
  const snapshot = baseSnapshot({
    lastSuccessfulEnrichment: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    metricsFreshness: "stale",
    dnaCompleteness: 58,
    dnaStatus: "partial",
    audienceKnown: false,
  });

  const policy = resolveEnrichmentPolicy({
    resolutionContext: Object.freeze({
      feature: "manual_refresh",
      force: false,
      requestedBy: null,
      platform: null,
      tier: null,
      campaignId: null,
    }),
  });

  const health = calculateIntelligenceHealthScore({ snapshot, policy });
  assert.ok(health.overallScore < 75);
  assert.equal(health.creatorId, "creator-1");

  const report = generateRefreshRecommendations({ snapshot, policy });
  assert.ok(report.recommendations.some((rec) => rec.action === "refresh_metrics"));
  assert.ok(report.recommendations.some((rec) => rec.action === "refresh_dna"));
  assert.ok(report.healthScore < 75);
}

async function testRuleDisableWithoutEngineChange() {
  resetRuleManagementForTests();
  setRuleEnabled("FreshnessRule", false);
  const { DecisionRuleRegistry } = await import(
    "@/lib/creator-enrichment/decision/rule-registry"
  );
  const { FreshnessRule: FreshnessRuleClass, ForceRule: ForceRuleClass } = await import(
    "@/lib/creator-enrichment/decision/rules"
  );
  const registry = new DecisionRuleRegistry().registerAll([
    new ForceRuleClass(),
    new FreshnessRuleClass(),
  ]);
  const ordered = registry.getOrderedRules("refresh");
  assert.equal(ordered.some((rule) => rule.id === "FreshnessRule"), false);
}

async function testGovernanceReportAndValidation() {
  resetGovernancePolicyForTests();
  resetDecisionAnalyticsForTests();
  assert.equal(validateGovernancePolicy().valid, true);
  const report = buildGovernanceReport();
  assert.equal(report.platformReadiness.autonomousRecommendationsReady, true);
  assert.ok(report.ruleManagement.enabledCount > 0);
  assert.equal(getDecisionAnalyticsSnapshot().totalRecords, 0);
}

async function run() {
  await testPolicyChangesFreshnessDecision();
  await testForceRefreshBlockedByPolicy();
  await testHealthScoreAndRecommendations();
  await testRuleDisableWithoutEngineChange();
  await testGovernanceReportAndValidation();
  console.log("governance.test.ts: all tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
