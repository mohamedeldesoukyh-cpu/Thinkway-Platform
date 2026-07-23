import assert from "node:assert/strict";

import type { CreatorEnrichmentDecisionResult } from "@/lib/creator-enrichment/decision/decision-result";
import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";
import {
  buildExecutionPlan,
  PIPELINE_ENFORCEMENT_ENABLED,
  resetOptimizationPolicyForTests,
  setOptimizationPolicyForTests,
} from "@/lib/creator-enrichment/execution";

function baseSnapshot(
  overrides: Partial<CreatorIntelligenceSnapshot> = {}
): CreatorIntelligenceSnapshot {
  return Object.freeze({
    creatorId: "creator-1",
    influencerId: "creator-1",
    platformAccountId: "pa-1",
    enrichmentRunning: false,
    queueStatus: "idle",
    lastEnrichment: null,
    lastSuccessfulEnrichment: null,
    lastManualRefresh: null,
    lastIPLFetch: null,
    dnaStatus: "missing",
    dnaCompleteness: null,
    metricsFreshness: "unknown",
    avatarFreshness: null,
    countryKnown: false,
    audienceKnown: false,
    hasCreatorDNA: false,
    hasIPLSnapshot: false,
    metadata: Object.freeze({
      snapshotVersion: "2.4",
      providerVersion: "2.4",
      schemaVersion: "1.0",
      dataSourcesUsed: ["test"],
    }),
    ...overrides,
  });
}

function baseDecision(
  overrides: Partial<CreatorEnrichmentDecisionResult> = {}
): CreatorEnrichmentDecisionResult {
  return Object.freeze({
    decision: "proceed",
    delegate: "executeCreatorMetricsRefresh",
    reason: "creator_stale",
    decisionId: "decision-1",
    traceId: "trace-1",
    decisionTime: "2026-07-19T00:00:00.000Z",
    decisionTimeMs: 5,
    snapshotBuildTimeMs: 3,
    snapshotVersion: "2.4",
    winningRule: "FreshnessRule",
    decidingRuleId: "FreshnessRule",
    ruleEvaluations: Object.freeze([]),
    evaluatedRules: Object.freeze([]),
    ruleExecutionSummary: Object.freeze({}),
    ...overrides,
  });
}

function stageAction(plan: ReturnType<typeof buildExecutionPlan>, stage: string) {
  return plan.stages.find((s) => s.stage === stage)?.action;
}

async function testFreshCreatorReusesAllStages() {
  resetOptimizationPolicyForTests();
  const now = Date.now();
  const recent = new Date(now - 1_000).toISOString();

  const plan = buildExecutionPlan({
    requestId: "req-fresh",
    force: false,
    snapshot: baseSnapshot({
      metricsFreshness: "fresh",
      avatarFreshness: "fresh",
      lastSuccessfulEnrichment: recent,
      lastIPLFetch: recent,
      hasIPLSnapshot: true,
      hasCreatorDNA: true,
      dnaStatus: "complete",
      dnaCompleteness: 85,
      audienceKnown: true,
    }),
    decision: baseDecision({ reason: "creator_stale" }),
  });

  assert.equal(stageAction(plan, "metrics"), "reuse");
  assert.equal(stageAction(plan, "ipl"), "reuse");
  assert.equal(stageAction(plan, "creatorDna"), "reuse");
  assert.equal(stageAction(plan, "avatar"), "reuse");
  assert.equal(stageAction(plan, "audience"), "reuse");
  assert.equal(stageAction(plan, "platformMetadata"), "reuse");
  assert.equal(stageAction(plan, "aiAnalysis"), "skip");
  assert.equal(plan.totals.stagesReuse, 6);
  assert.equal(plan.totals.stagesRun, 0);
  assert.ok(plan.totals.optimizationPercentage > 0);
  assert.equal(plan.enforcementEnabled, PIPELINE_ENFORCEMENT_ENABLED);
  assert.equal(plan.pipelineMode, "full_legacy");
}

async function testNewCreatorRunsAllPipelineStages() {
  resetOptimizationPolicyForTests();

  const plan = buildExecutionPlan({
    requestId: "req-new",
    force: false,
    snapshot: baseSnapshot(),
    decision: baseDecision(),
  });

  assert.equal(stageAction(plan, "metrics"), "run");
  assert.equal(stageAction(plan, "ipl"), "run");
  assert.equal(stageAction(plan, "creatorDna"), "run");
  assert.equal(stageAction(plan, "avatar"), "run");
  assert.equal(stageAction(plan, "audience"), "run");
  assert.equal(stageAction(plan, "platformMetadata"), "run");
  assert.equal(plan.totals.stagesRun, 6);
  assert.ok(plan.totals.estimatedApifyCredits >= 1);
}

async function testForcedRefreshRunsAllExceptAi() {
  resetOptimizationPolicyForTests();

  const plan = buildExecutionPlan({
    requestId: "req-force",
    force: true,
    snapshot: baseSnapshot({
      metricsFreshness: "fresh",
      hasIPLSnapshot: true,
      hasCreatorDNA: true,
      dnaCompleteness: 95,
    }),
    decision: baseDecision({
      reason: "force_refresh",
      winningRule: "ForceRule",
    }),
  });

  assert.equal(stageAction(plan, "metrics"), "run");
  assert.equal(stageAction(plan, "ipl"), "run");
  assert.equal(stageAction(plan, "creatorDna"), "run");
  assert.equal(stageAction(plan, "avatar"), "run");
  assert.equal(stageAction(plan, "audience"), "run");
  assert.equal(stageAction(plan, "platformMetadata"), "run");
  assert.equal(stageAction(plan, "aiAnalysis"), "skip");
}

async function testAlreadyRunningSkipsAllStages() {
  resetOptimizationPolicyForTests();

  const plan = buildExecutionPlan({
    requestId: "req-running",
    force: false,
    snapshot: baseSnapshot({ enrichmentRunning: true, queueStatus: "running" }),
    decision: baseDecision({
      decision: "already_running",
      reason: "enrichment_in_progress",
      winningRule: "QueueRule",
    }),
  });

  assert.equal(plan.decision, "already_running");
  assert.equal(plan.totals.stagesSkip, 7);
  assert.equal(plan.totals.estimatedApifyCredits, 0);
  assert.match(plan.optimizationSummary, /already_running/);
}

async function testPartiallyEnrichedCreatorMixedPlan() {
  resetOptimizationPolicyForTests();
  const now = Date.now();
  const recent = new Date(now - 1_000).toISOString();

  const plan = buildExecutionPlan({
    requestId: "req-partial",
    force: false,
    snapshot: baseSnapshot({
      metricsFreshness: "stale",
      lastIPLFetch: recent,
      hasIPLSnapshot: true,
      hasCreatorDNA: false,
      dnaStatus: "missing",
      audienceKnown: true,
      lastSuccessfulEnrichment: recent,
    }),
    decision: baseDecision(),
  });

  assert.equal(stageAction(plan, "metrics"), "run");
  assert.equal(stageAction(plan, "ipl"), "reuse");
  assert.equal(stageAction(plan, "creatorDna"), "run");
  assert.equal(stageAction(plan, "audience"), "reuse");
  assert.equal(plan.totals.stagesRun, 3);
  assert.equal(plan.totals.stagesReuse, 3);
}

async function testDnaThresholdFromPolicy() {
  resetOptimizationPolicyForTests();
  setOptimizationPolicyForTests({ dnaCompletenessThreshold: 80 });

  const below = buildExecutionPlan({
    requestId: "req-dna-below",
    force: false,
    snapshot: baseSnapshot({
      hasCreatorDNA: true,
      dnaStatus: "partial",
      dnaCompleteness: 75,
    }),
    decision: baseDecision(),
  });
  assert.equal(stageAction(below, "creatorDna"), "run");

  const above = buildExecutionPlan({
    requestId: "req-dna-above",
    force: false,
    snapshot: baseSnapshot({
      hasCreatorDNA: true,
      dnaStatus: "complete",
      dnaCompleteness: 85,
      metricsFreshness: "fresh",
    }),
    decision: baseDecision(),
  });
  assert.equal(stageAction(above, "creatorDna"), "reuse");
}

async function testCostAndDurationEstimatesPresent() {
  resetOptimizationPolicyForTests();

  const plan = buildExecutionPlan({
    requestId: "req-estimates",
    force: false,
    snapshot: baseSnapshot(),
    decision: baseDecision(),
  });

  assert.ok(plan.totals.estimatedDurationMs > 0);
  assert.ok(plan.totals.estimatedApifyCredits > 0);
  for (const stage of plan.stages) {
    assert.ok(stage.reason.length > 0);
    if (stage.action === "run") {
      assert.ok(stage.estimatedDurationMs > 0);
    }
  }
}

async function run() {
  await testFreshCreatorReusesAllStages();
  await testNewCreatorRunsAllPipelineStages();
  await testForcedRefreshRunsAllExceptAi();
  await testAlreadyRunningSkipsAllStages();
  await testPartiallyEnrichedCreatorMixedPlan();
  await testDnaThresholdFromPolicy();
  await testCostAndDurationEstimatesPresent();
  console.log("execution-planner.test.ts: all tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
