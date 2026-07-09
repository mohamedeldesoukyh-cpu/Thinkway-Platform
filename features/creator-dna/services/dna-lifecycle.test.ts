import assert from "node:assert/strict";
import { test } from "node:test";

import { appendIntelligenceSource, resolveLifecycleAfterMerge } from "./dna-lifecycle";

test("appendIntelligenceSource keeps unique history", () => {
  const sources = appendIntelligenceSource(["baseline_import"], "apify_enrichment");
  assert.deepEqual(sources, ["baseline_import", "apify_enrichment"]);
  assert.deepEqual(appendIntelligenceSource(sources, "baseline_import"), sources);
});

test("resolveLifecycleAfterMerge advances to ENRICHED after apify", () => {
  const lifecycle = resolveLifecycleAfterMerge({
    current: "BASELINE",
    mergeSource: "apify_enrichment",
    influencerStatus: "active",
    isImport: false,
    hasCampaignHistory: false,
    hasEnrichmentSnapshot: true,
  });
  assert.equal(lifecycle, "ENRICHED");
});

test("resolveLifecycleAfterMerge marks archived influencers", () => {
  const lifecycle = resolveLifecycleAfterMerge({
    current: "ACTIVE",
    mergeSource: "manual_update",
    influencerStatus: "archived",
    isImport: false,
    hasCampaignHistory: true,
    hasEnrichmentSnapshot: false,
  });
  assert.equal(lifecycle, "ARCHIVED");
});

test("resolveLifecycleAfterMerge promotes campaign veterans to ACTIVE", () => {
  const lifecycle = resolveLifecycleAfterMerge({
    current: "BASELINE",
    mergeSource: "baseline_import",
    influencerStatus: "active",
    isImport: true,
    hasCampaignHistory: true,
    hasEnrichmentSnapshot: false,
  });
  assert.equal(lifecycle, "ACTIVE");
});
