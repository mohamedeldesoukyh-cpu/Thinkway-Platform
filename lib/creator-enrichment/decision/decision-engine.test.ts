import assert from "node:assert/strict";

import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";
import {
  buildCreatorIntelligenceSnapshot,
  buildDecisionContextFromRefreshRequest,
  CreatorEnrichmentDecisionEngine,
  DecisionRuleRegistry,
  getDefaultRuleRegistry,
  PlaceholderCreatorIntelligenceSnapshotProvider,
  resetDecisionMetricsForTests,
  resetDefaultRuleRegistryForTests,
  resetDefaultSnapshotProviderForTests,
  setDefaultSnapshotProviderForTests,
  type CreatorIntelligenceSnapshot,
  type CreatorIntelligenceSnapshotData,
  type CreatorIntelligenceSnapshotProvider,
} from "@/lib/creator-enrichment/decision";
import type { DecisionRule } from "@/lib/creator-enrichment/decision/rule-contract";
import { normalizeRefreshRequest } from "@/lib/creator-enrichment/orchestrator/request-normalizer";

function mockSupabase() {
  return {} as never;
}

function freshSnapshotProvider(): CreatorIntelligenceSnapshotProvider {
  const recentlyEnrichedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return {
    async provide(context): Promise<CreatorIntelligenceSnapshotData> {
      return {
        creatorId: context.creatorId,
        influencerId: context.creatorId,
        platformAccountId: context.platformAccountId,
        enrichmentRunning: false,
        queueStatus: "idle",
        lastEnrichment: recentlyEnrichedAt,
        lastSuccessfulEnrichment: recentlyEnrichedAt,
        lastManualRefresh: null,
        lastIPLFetch: recentlyEnrichedAt,
        dnaStatus: "complete",
        dnaCompleteness: 80,
        metricsFreshness: "fresh",
        avatarFreshness: null,
        countryKnown: true,
        audienceKnown: false,
        hasCreatorDNA: true,
        hasIPLSnapshot: true,
        metadata: {
          snapshotVersion: "2.4",
          providerVersion: "2.4",
          schemaVersion: "1.0",
          dataSourcesUsed: ["test"],
        },
      };
    },
  };
}

async function testForceProceeds() {
  setDefaultSnapshotProviderForTests(freshSnapshotProvider());
  const engine = new CreatorEnrichmentDecisionEngine();
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "manual",
    feature: "manual_refresh",
    force: true,
    scope: "metrics",
    requestedBy: "user-1",
  });
  const context = buildDecisionContextFromRefreshRequest(
    request,
    "refreshCreatorMetrics"
  );

  const result = await engine.decide(context);

  assert.equal(result.decision, "proceed");
  assert.equal(result.reason, "force_refresh");
  assert.equal(result.winningRule, "ForceRule");
  assert.equal(result.ruleEvaluations.length, 1);
  assert.ok(result.traceId.length > 0);
  assert.equal(result.evaluatedRules.length, 1);
}

async function testFreshCreatorSkips() {
  setDefaultSnapshotProviderForTests(freshSnapshotProvider());
  const engine = new CreatorEnrichmentDecisionEngine();
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "shortlist",
    force: false,
  });
  const context = buildDecisionContextFromRefreshRequest(
    request,
    "refreshCreatorMetrics"
  );

  const result = await engine.decide(context);

  assert.equal(result.decision, "skip");
  assert.equal(result.reason, "creator_already_fresh");
  assert.equal(result.winningRule, "FreshnessRule");
}

async function testStaleCreatorProceeds() {
  setDefaultSnapshotProviderForTests(new PlaceholderCreatorIntelligenceSnapshotProvider());
  const engine = new CreatorEnrichmentDecisionEngine();
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "shortlist",
    force: false,
  });
  const context = buildDecisionContextFromRefreshRequest(
    request,
    "refreshCreatorMetrics"
  );

  const result = await engine.decide(context);

  assert.equal(result.decision, "proceed");
  assert.equal(result.reason, "creator_stale");
  assert.equal(result.winningRule, "FreshnessRule");
}

async function testQueueAlreadyRunning() {
  const provider: CreatorIntelligenceSnapshotProvider = {
    async provide(context) {
      return {
        ...(await freshSnapshotProvider().provide(context)),
        enrichmentRunning: true,
        queueStatus: "running",
      };
    },
  };
  setDefaultSnapshotProviderForTests(provider);
  const engine = new CreatorEnrichmentDecisionEngine();
  const context = buildDecisionContextFromRefreshRequest(
    normalizeRefreshRequest(mockSupabase(), "creator-1", {
      trigger: "shortlist",
      force: false,
    }),
    "refreshCreatorMetrics"
  );

  const result = await engine.decide(context);
  assert.equal(result.decision, "already_running");
  assert.equal(result.winningRule, "QueueRule");
}

function testContextIsImmutable() {
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "manual",
  });
  const context = buildDecisionContextFromRefreshRequest(
    request,
    "refreshCreatorMetrics"
  );

  assert.throws(() => {
    (context as { creatorId: string }).creatorId = "mutated";
  });
}

function testContextFields() {
  const request = normalizeRefreshRequest(mockSupabase(), "creator-1", {
    trigger: "manual",
    feature: "add_creator",
    force: true,
    scope: "all",
    requestedBy: "actor-1",
    platformAccountId: "platform-1",
  });
  const context = buildDecisionContextFromRefreshRequest(
    request,
    "refreshCreatorMetrics"
  );

  assert.equal(context.requestId, request.requestId);
  assert.equal(context.platformAccountId, "platform-1");
  assert.equal(context.force, true);
}

async function testSnapshotBuiltForEveryDecision() {
  let provideCalls = 0;
  const inner = new PlaceholderCreatorIntelligenceSnapshotProvider();
  const provider: CreatorIntelligenceSnapshotProvider = {
    async provide(context) {
      provideCalls += 1;
      return inner.provide(context);
    },
  };

  const engine = new CreatorEnrichmentDecisionEngine(getDefaultRuleRegistry(), provider);
  const context = buildDecisionContextFromRefreshRequest(
    normalizeRefreshRequest(mockSupabase(), "creator-99", { trigger: "manual", force: true }),
    "refreshCreatorMetrics"
  );

  await engine.decide(context);
  assert.equal(provideCalls, 1);
}

async function testSameSnapshotPassedToEveryRule() {
  const seen: CreatorIntelligenceSnapshot[] = [];
  const capturingRule = (index: number): DecisionRule => ({
    id: `CapturingRule${index}`,
    priority: 10 - index,
    description: "test capture",
    supportedOperations: ["refresh"],
    evaluate(_context, snapshot) {
      seen.push(snapshot);
      return {
        ruleId: `CapturingRule${index}`,
        priority: 10 - index,
        opinion: "no_opinion",
        executionTimeMs: 0,
      };
    },
  });

  const registry = new DecisionRuleRegistry()
    .register(capturingRule(1))
    .register(capturingRule(2))
    .register(capturingRule(3));

  setDefaultSnapshotProviderForTests(new PlaceholderCreatorIntelligenceSnapshotProvider());
  const engine = new CreatorEnrichmentDecisionEngine(registry);
  const context = buildDecisionContextFromRefreshRequest(
    normalizeRefreshRequest(mockSupabase(), "creator-1", { trigger: "manual", force: true }),
    "refreshCreatorMetrics"
  );

  await engine.decide(context);

  assert.equal(seen.length, 3);
  assert.equal(seen[0], seen[1]);
  assert.equal(seen[1], seen[2]);
}

async function testSnapshotIsImmutable() {
  setDefaultSnapshotProviderForTests(new PlaceholderCreatorIntelligenceSnapshotProvider());
  const context = buildDecisionContextFromRefreshRequest(
    normalizeRefreshRequest(mockSupabase(), "creator-1", { trigger: "manual" }),
    "refreshCreatorMetrics"
  );
  const snapshot = await buildCreatorIntelligenceSnapshot(context);

  assert.throws(() => {
    (snapshot as { creatorId: string }).creatorId = "mutated";
  });
}

async function testPlaceholderProviderPerformsNoIo() {
  setDefaultSnapshotProviderForTests(new PlaceholderCreatorIntelligenceSnapshotProvider());
  const context = buildDecisionContextFromRefreshRequest(
    normalizeRefreshRequest(mockSupabase(), "creator-1", { trigger: "manual" }),
    "refreshCreatorMetrics"
  );
  const snapshot = await buildCreatorIntelligenceSnapshot(context);

  assert.equal(snapshot.hasCreatorDNA, null);
  assert.equal(snapshot.metricsFreshness, null);
  assert.equal(snapshot.metadata.phase, "2.1");
}

async function run() {
  resetDefaultSnapshotProviderForTests();
  resetDefaultRuleRegistryForTests();
  resetDecisionMetricsForTests();
  await testForceProceeds();
  await testFreshCreatorSkips();
  await testStaleCreatorProceeds();
  await testQueueAlreadyRunning();
  testContextIsImmutable();
  testContextFields();
  await testSnapshotBuiltForEveryDecision();
  await testSameSnapshotPassedToEveryRule();
  await testSnapshotIsImmutable();
  await testPlaceholderProviderPerformsNoIo();
  console.log("decision-engine.test.ts: all tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
