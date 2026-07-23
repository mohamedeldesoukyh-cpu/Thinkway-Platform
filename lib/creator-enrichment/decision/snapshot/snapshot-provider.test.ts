import assert from "node:assert/strict";

import { buildDecisionContextFromBatchRequest } from "@/lib/creator-enrichment/decision/decision-context";
import {
  computeSnapshotCompleteness,
  gatherCreatorIntelligenceSnapshot,
  PlatformCreatorIntelligenceSnapshotProvider,
} from "@/lib/creator-enrichment/decision/snapshot";
import { normalizeBatchRequest } from "@/lib/creator-enrichment/orchestrator/request-normalizer";
import { isEnrichmentStale } from "@/lib/creator-enrichment/policy";

function mockSupabase() {
  return {} as never;
}

function createGatherMockSupabase() {
  return {
    from(table: string) {
      if (table === "influencers") {
        return {
          select: (_columns?: string) => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  last_enriched_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                  country_code: "AE",
                  enrichment_status: "enriched",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "influencer_platform_accounts") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ enrichment_status: "enriched" }],
                error: null,
              }),
          }),
        };
      }

      if (table === "creator_enrichment_runs") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      started_at: "2026-07-01T00:00:00.000Z",
                      completed_at: "2026-07-01T00:05:00.000Z",
                      status: "completed",
                      trigger: "manual",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "creator_dna") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }

      if (table === "ipl_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { id: "snap-1", fetched_at: "2026-07-10T00:00:00.000Z" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      };
    },
  } as never;
}

async function testBatchScopeSnapshotHasNoCreatorFields() {
  const provider = new PlatformCreatorIntelligenceSnapshotProvider();
  const context = buildDecisionContextFromBatchRequest(
    normalizeBatchRequest(mockSupabase(), ["creator-1", "creator-2"], {
      trigger: "manual",
    }),
    "refreshCreatorMetricsBatchByUnifiedIds"
  );

  const snapshot = await provider.provide(context);

  assert.equal(snapshot.creatorId, null);
  assert.equal(snapshot.influencerId, null);
  assert.equal(snapshot.metadata.batchScope, true);
  assert.equal(snapshot.metadata.snapshotVersion, "2.4");
  assert.deepEqual(snapshot.metadata.dataSourcesUsed, []);
}

async function testGatherReadsStoredPlatformData() {
  const snapshot = await gatherCreatorIntelligenceSnapshot({
    influencerId: "creator-1",
    platformAccountId: null,
    supabase: createGatherMockSupabase(),
  });

  assert.equal(snapshot.creatorId, "creator-1");
  assert.equal(snapshot.influencerId, "creator-1");
  assert.equal(snapshot.countryKnown, true);
  assert.equal(snapshot.hasIPLSnapshot, true);
  assert.equal(snapshot.lastIPLFetch, "2026-07-10T00:00:00.000Z");
  assert.equal(snapshot.lastManualRefresh, "2026-07-01T00:00:00.000Z");
  assert.equal(snapshot.hasCreatorDNA, false);
  assert.equal(snapshot.dnaStatus, "missing");
  assert.equal(snapshot.metricsFreshness, "fresh");
  assert.equal(snapshot.metadata.snapshotVersion, "2.4");
  assert.ok(snapshot.metadata.dataSourcesUsed.includes("influencers"));
  assert.ok(snapshot.metadata.dataSourcesUsed.includes("ipl_snapshot"));
  assert.ok(snapshot.metadata.dataSourcesUsed.includes("creator_enrichment_runs"));
}

function testMetricsFreshnessReusesPolicy() {
  const freshAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const staleAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(isEnrichmentStale(freshAt), false);
  assert.equal(isEnrichmentStale(staleAt), true);
}

function testCompletenessCountsPopulatedFields() {
  const report = computeSnapshotCompleteness({
    creatorId: "c1",
    influencerId: "c1",
    platformAccountId: null,
    enrichmentRunning: true,
    queueStatus: "queued",
    lastEnrichment: null,
    lastSuccessfulEnrichment: null,
    lastManualRefresh: null,
    lastIPLFetch: null,
    dnaStatus: null,
    dnaCompleteness: null,
    metricsFreshness: "fresh",
    avatarFreshness: null,
    countryKnown: true,
    audienceKnown: null,
    hasCreatorDNA: false,
    hasIPLSnapshot: false,
    metadata: {},
  });

  assert.equal(report.populatedFields.includes("creatorId"), true);
  assert.equal(report.populatedFields.includes("metricsFreshness"), true);
  assert.equal(report.snapshotCompleteness > 0, true);
}

async function run() {
  await testBatchScopeSnapshotHasNoCreatorFields();
  await testGatherReadsStoredPlatformData();
  testMetricsFreshnessReusesPolicy();
  testCompletenessCountsPopulatedFields();
  console.log("snapshot-provider.test.ts: all tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
