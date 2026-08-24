import assert from "node:assert/strict";

import {
  CreatorEnrichmentDecisionEngine,
  PlaceholderCreatorIntelligenceSnapshotProvider,
  type CreatorEnrichmentDecisionOutcome,
} from "@/lib/creator-enrichment/decision";
import {
  CreatorEnrichmentOrchestrator,
  type CreatorEnrichmentOrchestratorAdapters,
} from "@/lib/creator-enrichment/orchestrator/creator-enrichment-orchestrator";
import {
  inferFeature,
  normalizeRefreshRequest,
  resolveFeature,
} from "@/lib/creator-enrichment/orchestrator/request-normalizer";
import type {
  CreatorEnrichmentJobPayload,
  CreatorEnrichmentResult,
  EnqueueResult,
} from "@/lib/creator-enrichment/types";
import type {
  RefreshCreatorMetricsBatchResult,
  RefreshCreatorMetricsResult,
} from "@/lib/services/creators/creator-enrichment-service-shared";

function mockSupabase() {
  return {} as never;
}

function buildAdapters(overrides?: Partial<CreatorEnrichmentOrchestratorAdapters>) {
  const refreshResult: RefreshCreatorMetricsResult = {
    ok: true,
    influencerId: "creator-1",
    syncStatus: "queued",
    queued: true,
    message: "Refresh queued.",
    jobId: "job-1",
  };

  const enqueueResult: EnqueueResult = {
    queued: true,
    jobId: "job-2",
  };

  const executeResult: CreatorEnrichmentResult = {
    ok: true,
    status: "enriched",
    message: "Done",
    fieldsUpdated: ["followers"],
  };

  const batchResult: RefreshCreatorMetricsBatchResult = {
    ok: true,
    total: 2,
    queued: 2,
    failed: 0,
    results: [refreshResult, refreshResult],
  };

  const adapters: CreatorEnrichmentOrchestratorAdapters = {
    refreshCreatorMetrics: async () => refreshResult,
    enqueueCreatorEnrichment: async () => enqueueResult,
    executeCreatorMetricsRefresh: async () => executeResult,
    refreshCreatorMetricsBatchByUnifiedIds: async () => batchResult,
    ...overrides,
  };

  return {
    adapters,
    refreshResult,
    enqueueResult,
    executeResult,
    batchResult,
  };
}

function buildOrchestrator(adapters: CreatorEnrichmentOrchestratorAdapters) {
  const decisionEngine = new CreatorEnrichmentDecisionEngine(
    undefined,
    new PlaceholderCreatorIntelligenceSnapshotProvider()
  );
  return new CreatorEnrichmentOrchestrator(adapters, decisionEngine);
}

async function testRequestRefreshReturnsUnchangedResult() {
  const { adapters, refreshResult } = buildAdapters();
  const orchestrator = buildOrchestrator(adapters);

  const result = await orchestrator.requestRefresh(mockSupabase(), "creator-1", {
    trigger: "manual",
    scope: "metrics",
    requestedBy: "user-1",
  });

  assert.deepEqual(result, refreshResult);
}

async function testExecuteJobReturnsUnchangedResult() {
  const { adapters, executeResult } = buildAdapters();
  const orchestrator = buildOrchestrator(adapters);

  const payload: CreatorEnrichmentJobPayload = {
    influencerId: "creator-1",
    trigger: "manual",
    priority: 4,
    force: true,
    scope: "all",
  };

  const result = await orchestrator.executeJob(mockSupabase(), payload, {
    attempt: 1,
    jobId: "worker-job-1",
  });

  assert.deepEqual(result, executeResult);
}

async function testEnqueueReturnsUnchangedResult() {
  const { adapters, enqueueResult } = buildAdapters();
  const orchestrator = buildOrchestrator(adapters);

  const result = await orchestrator.enqueue({
    influencerId: "creator-1",
    trigger: "shortlist",
    priority: 2,
    force: false,
    scope: "all",
  });

  assert.deepEqual(result, enqueueResult);
}

async function testBatchRefreshReturnsUnchangedResult() {
  let receivedIds: string[] | null = null;
  const { adapters, batchResult } = buildAdapters({
    refreshCreatorMetricsBatchByUnifiedIds: async (_supabase, unifiedIds) => {
      receivedIds = unifiedIds;
      return batchResult;
    },
  });
  const orchestrator = buildOrchestrator(adapters);

  const result = await orchestrator.requestBatchRefresh(
    mockSupabase(),
    ["inf:creator-1", "inf:creator-2"],
    { trigger: "manual", isBulk: true, scope: "metrics", force: false }
  );

  assert.deepEqual(receivedIds, ["inf:creator-1", "inf:creator-2"]);
  assert.equal(result.total, 2);
  assert.equal(result.queued, batchResult.queued);
}

async function testFeatureInference() {
  assert.equal(inferFeature("shortlist"), "shortlist");
  assert.equal(inferFeature("campaign"), "campaign_studio");
  assert.equal(inferFeature("stale"), "dataset_import");
  assert.equal(inferFeature("manual", { isBulk: true }), "batch_refresh");
  assert.equal(inferFeature("manual"), "manual_refresh");
  assert.equal(inferFeature("manual", { mode: "inline" }), "manual_refresh");
}

async function testNormalizedRequestAssignsRequestId() {
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "manual",
    scope: "metrics",
    force: true,
    requestedBy: "user-1",
  });

  assert.ok(request.requestId.length > 0);
  assert.equal(request.creatorId, "creator-1");
  assert.equal(request.trigger, "manual");
  assert.equal(request.feature, "manual_refresh");
  assert.equal(request.scope, "metrics");
  assert.equal(request.requestedBy, "user-1");
  assert.equal(request.force, true);
  assert.equal(request.options.force, true);
}

async function testInlineLiveRefreshStaysManualRefreshFeature() {
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "manual",
    mode: "inline",
    force: true,
    dataSource: "live_apify",
  });
  assert.equal(request.feature, "manual_refresh");
  assert.equal(request.force, true);
  assert.equal(request.options.mode, "inline");
}

async function testForceDefaultsToFalse() {
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "manual",
    scope: "metrics",
  });
  assert.equal(request.force, false);
  assert.equal(request.options.force, false);
}

async function testFailedRefreshStillReturnsDelegateResult() {
  const failedResult: RefreshCreatorMetricsResult = {
    ok: false,
    influencerId: "creator-1",
    syncStatus: "failed",
    queued: false,
    message: "Could not queue enrichment.",
  };

  const orchestrator = new CreatorEnrichmentOrchestrator(
    {
      ...buildAdapters().adapters,
      refreshCreatorMetrics: async () => failedResult,
    },
    new CreatorEnrichmentDecisionEngine(
      undefined,
      new PlaceholderCreatorIntelligenceSnapshotProvider()
    )
  );

  const result = await orchestrator.requestRefresh(mockSupabase(), "creator-1");
  assert.deepEqual(result, failedResult);
}

async function testExplicitFeatureOverridesInference() {
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "manual",
    feature: "add_creator",
  });
  assert.equal(request.feature, "add_creator");
}

async function testResolveFeaturePrefersExplicit() {
  assert.equal(
    resolveFeature("manual", { feature: "campaign_studio" }),
    "campaign_studio"
  );
}

function freshSkipDecision(
  creatorId: string,
  overrides?: Partial<CreatorEnrichmentDecisionOutcome>
): CreatorEnrichmentDecisionOutcome {
  return Object.freeze({
    decision: "skip",
    delegate: "refreshCreatorMetrics",
    reason: "creator_already_fresh",
    decisionId: "test-decision-id",
    traceId: "test-trace-id",
    decisionTime: new Date().toISOString(),
    decisionTimeMs: 1,
    snapshotBuildTimeMs: 0,
    snapshotVersion: "2.4",
    winningRule: "FreshnessRule",
    decidingRuleId: "FreshnessRule",
    ruleEvaluations: Object.freeze([]),
    evaluatedRules: Object.freeze([]),
    ruleExecutionSummary: Object.freeze({}),
    snapshot: Object.freeze({
      creatorId,
      influencerId: creatorId,
      platformAccountId: null,
      enrichmentRunning: false,
      queueStatus: "idle",
      lastEnrichment: "2026-07-18T00:00:00.000Z",
      lastSuccessfulEnrichment: "2026-07-18T00:00:00.000Z",
      lastManualRefresh: null,
      lastIPLFetch: null,
      dnaStatus: "complete",
      dnaCompleteness: 80,
      metricsFreshness: "fresh",
      avatarFreshness: null,
      countryKnown: true,
      audienceKnown: false,
      hasCreatorDNA: true,
      hasIPLSnapshot: true,
      metadata: Object.freeze({ snapshotVersion: "2.4" }),
    }),
    ...overrides,
  });
}

async function testFreshCreatorSkipsWithoutDelegating() {
  let refreshCalled = false;
  const skipEngine = {
    decide: async () => freshSkipDecision("creator-1"),
  };

  const orchestrator = new CreatorEnrichmentOrchestrator(
    {
      ...buildAdapters().adapters,
      refreshCreatorMetrics: async () => {
        refreshCalled = true;
        throw new Error("should not delegate");
      },
    },
    skipEngine as CreatorEnrichmentDecisionEngine
  );

  const result = await orchestrator.requestRefresh(mockSupabase(), "creator-1", {
    force: false,
    trigger: "shortlist",
  });

  assert.equal(refreshCalled, false);
  assert.equal(result.skipped, true);
  assert.equal(result.queued, false);
  assert.equal(result.ok, true);
  assert.equal(result.message, "creator_already_fresh");
}

async function testBatchRefreshRespectsDecisionEngine() {
  let receivedIds: string[] | null = null;
  const decisions = new Map<string, CreatorEnrichmentDecisionOutcome>([
    ["creator-1", freshSkipDecision("creator-1")],
    [
      "creator-2",
      freshSkipDecision("creator-2", {
        decision: "proceed",
        reason: "creator_stale",
        winningRule: "FreshnessRule",
        decidingRuleId: "FreshnessRule",
      }),
    ],
    [
      "creator-3",
      freshSkipDecision("creator-3", {
        decision: "already_running",
        reason: "enrichment_already_in_progress",
        winningRule: "QueueRule",
        decidingRuleId: "QueueRule",
        snapshot: Object.freeze({
          ...freshSkipDecision("creator-3").snapshot,
          enrichmentRunning: true,
          queueStatus: "running",
        }),
      }),
    ],
  ]);

  const engine = {
    decide: async (context: { creatorId: string | null }) => {
      const id = context.creatorId ?? "";
      const decision = decisions.get(id);
      if (!decision) throw new Error(`unexpected creator ${id}`);
      return decision;
    },
  };

  const adapters = buildAdapters({
    refreshCreatorMetricsBatchByUnifiedIds: async (_supabase, unifiedIds) => {
      receivedIds = unifiedIds;
      return {
        ok: true,
        total: unifiedIds.length,
        queued: unifiedIds.length,
        failed: 0,
        results: unifiedIds.map((id) => ({
          ok: true,
          influencerId: id.replace(/^inf:/, ""),
          syncStatus: "queued" as const,
          queued: true,
          message: "Refresh queued.",
        })),
      };
    },
  }).adapters;

  const orchestrator = new CreatorEnrichmentOrchestrator(
    adapters,
    engine as CreatorEnrichmentDecisionEngine
  );

  const result = await orchestrator.requestBatchRefresh(
    mockSupabase(),
    ["inf:creator-1", "inf:creator-2", "inf:creator-3"],
    { trigger: "manual", isBulk: true, scope: "metrics", force: false }
  );

  assert.deepEqual(receivedIds, ["inf:creator-2"]);
  assert.equal(result.total, 3);
  assert.equal(result.queued, 1);
  assert.equal(result.results.filter((r) => r.skipped).length, 2);
  assert.ok(result.message?.includes("skipped by Decision Engine"));
}

async function testManualForceStillBypassesFreshness() {
  let refreshCalled = false;
  const skipUnlessForced = {
    decide: async (context: { force: boolean; creatorId: string | null }) => {
      if (context.force) {
        return freshSkipDecision(context.creatorId ?? "creator-1", {
          decision: "proceed",
          reason: "force_refresh",
          winningRule: "ForceRule",
          decidingRuleId: "ForceRule",
        });
      }
      return freshSkipDecision(context.creatorId ?? "creator-1");
    },
  };

  const orchestrator = new CreatorEnrichmentOrchestrator(
    {
      ...buildAdapters().adapters,
      refreshCreatorMetrics: async () => {
        refreshCalled = true;
        return {
          ok: true,
          influencerId: "creator-1",
          syncStatus: "queued",
          queued: true,
          message: "Refresh queued.",
        };
      },
    },
    skipUnlessForced as CreatorEnrichmentDecisionEngine
  );

  const result = await orchestrator.requestRefresh(mockSupabase(), "creator-1", {
    force: true,
    trigger: "manual",
    scope: "metrics",
  });

  assert.equal(refreshCalled, true);
  assert.equal(result.queued, true);
}

async function run() {
  await testRequestRefreshReturnsUnchangedResult();
  await testExecuteJobReturnsUnchangedResult();
  await testEnqueueReturnsUnchangedResult();
  await testBatchRefreshReturnsUnchangedResult();
  await testFeatureInference();
  await testNormalizedRequestAssignsRequestId();
  await testInlineLiveRefreshStaysManualRefreshFeature();
  await testForceDefaultsToFalse();
  await testExplicitFeatureOverridesInference();
  await testResolveFeaturePrefersExplicit();
  await testFailedRefreshStillReturnsDelegateResult();
  await testFreshCreatorSkipsWithoutDelegating();
  await testBatchRefreshRespectsDecisionEngine();
  await testManualForceStillBypassesFreshness();
  console.log("creator-enrichment-orchestrator.test.ts: all tests passed");
}

void run();
