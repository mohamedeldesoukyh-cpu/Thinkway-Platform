import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function loadFetch(input: { enabled?: boolean; cached?: boolean; cacheFirst?: boolean }) {
  let paid = 0;
  const source = readFileSync("lib/intelligence-persistence/services/fetch-orchestrator.ts", "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, any> = {};
  const paidCall = () => { paid++; throw new Error("Unexpected paid provider call"); };
  const deps: Record<string, unknown> = {
    "@/lib/creator-enrichment/apify-profile": { fetchApifyProfile: paidCall, fetchApifyProfileRaw: paidCall },
    "@/lib/creator-enrichment/manual-refresh-trace": { logManualRefreshTrace() {} },
    "@/lib/campaigns/deliverable-taxonomy": { canonicalPlatformKey: (v: string) => v },
    "../adapters": { getProviderAdapter: () => ({}) },
    "../config": { isIplEnabled: () => input.enabled !== false, isIplCacheFirstEnabled: () => input.cacheFirst !== false },
    "./provider-run-service": { createProviderRun: async () => null, completeProviderRun: async () => null },
    "./snapshot-service": { findLatestFreshSnapshot: async () => input.cached ? { id: "snapshot", normalized: { followerCount: 123 }, snapshotVersion: 1 } : null },
  };
  new Function("require", "exports", js)((name: string) => { if (!(name in deps)) throw new Error(name); return deps[name]; }, exports);
  return { fetch: exports.fetchProfileWithIpl, paid: () => paid };
}

for (const input of [{}, { enabled: false }, { cacheFirst: false }, { cached: true, cacheFirst: false }]) {
  test("cached choice cannot reach a paid provider: " + JSON.stringify(input), async () => {
    const harness = loadFetch(input);
    const result = await harness.fetch({}, { influencerId: "fixture", platformAccountId: "ig", platform: "instagram", cacheOnly: true, force: true });
    assert.equal(result.ok, "cached" in input);
    assert.equal(harness.paid(), 0);
  });
}

test("explicit live choice reaches provider instead of silently using cache", async () => {
  const harness = loadFetch({ cached: true });
  await assert.rejects(() => harness.fetch({}, { platform: "instagram", platformAccountId: "ig", force: true }), /Unexpected paid/);
  assert.equal(harness.paid(), 1);
});
