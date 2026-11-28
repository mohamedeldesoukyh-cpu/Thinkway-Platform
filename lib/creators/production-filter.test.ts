import test from "node:test";
import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { passesProductionCreatorGate, hasCreatorEnrichment, matchesCreatorActivity } from "./production-filter";

function discoveryCreator(stage: string, username: string): UnifiedCreatorResult {
  return {
    unified_id: "dis:1",
    source_type: "public_discovery",
    influencer_id: null,
    discovered_profile_id: "1",
    document_number: null,
    display_name: username,
    status: stage,
    country_code: "EG",
    categories: [],
    metrics: { followers: { value: 1000, confidence: "medium" } },
    thinkway_score: 50,
    source_confidence: 0.7,
    is_platform_verified: false,
    platforms: [{ id: "1", platform: "instagram", handle: username, is_verified: false }],
  } as unknown as UnifiedCreatorResult;
}

test("passesProductionCreatorGate allows freshly discovered non-synthetic profiles", () => {
  assert.equal(passesProductionCreatorGate(discoveryCreator("discovered", "adidas_runner_eg")), true);
});

test("passesProductionCreatorGate blocks synthetic mock_seed handles", () => {
  assert.equal(passesProductionCreatorGate(discoveryCreator("discovered", "tw_eg_sports_01")), false);
});

const neverEnriched = () => ({ ...discoveryCreator("discovered", "real_handle"), influencer_id: "real-id", enrichment_status: "never" as const });
test("search excludes a creator that has never been enriched", () => {
  assert.equal(hasCreatorEnrichment(neverEnriched()), false);
});
test("latest failure does not remove previously enriched creator", () => {
  assert.equal(hasCreatorEnrichment({ ...neverEnriched(), enrichment_status: "failed", last_enriched_at: "2026-09-18T00:00:00Z" }), true);
});
test("basic and partial enrichment remain visible", () => {
  assert.equal(hasCreatorEnrichment({ ...neverEnriched(), status: "basic_enriched" }), true);
  assert.equal(hasCreatorEnrichment({ ...neverEnriched(), enrichment_status: "partial" }), true);
});
test("account history preserves enrichment but imported numbers do not", () => {
  const c = neverEnriched();
  assert.equal(hasCreatorEnrichment({ ...c, platforms: [{ ...c.platforms[0], metrics_last_synced_at: "2026-09-18T00:00:00Z" }] }), true);
  assert.equal(hasCreatorEnrichment({ ...c, platforms: [{ ...c.platforms[0], follower_count: 1000, enrichment_status: "never", sync_status: "manual", sync_source: "discovery_import" }] }), false);
});

test("activity selector partitions enriched and never-enriched creators without deleting either", () => {
  const inactive = neverEnriched();
  const active = { ...inactive, last_enriched_at: "2026-09-18T00:00:00Z" };
  assert.equal(matchesCreatorActivity(active), true);
  assert.equal(matchesCreatorActivity(inactive), false);
  assert.equal(matchesCreatorActivity(active, "inactive"), false);
  assert.equal(matchesCreatorActivity(inactive, "inactive"), true);
  assert.equal(matchesCreatorActivity(active, "all"), true);
  assert.equal(matchesCreatorActivity(inactive, "all"), true);
});

test("successful empty enrichment belongs only in Not active and All", () => {
  const empty = { ...neverEnriched(), enrichment_status: "enriched" as const,
    last_enriched_at: "2026-07-07T03:51:25Z", metrics: {} as UnifiedCreatorResult["metrics"],
    platforms: [{ ...neverEnriched().platforms[0], follower_count: 0, engagement_rate: null,
      avg_views: null, avg_likes: 19, avg_comments: 3, enrichment_status: "enriched" as const }] };
  assert.equal(matchesCreatorActivity(empty), false);
  assert.equal(matchesCreatorActivity(empty, "inactive"), true);
  assert.equal(matchesCreatorActivity(empty, "all"), true);
  assert.equal(matchesCreatorActivity({ ...empty, platforms: [{ ...empty.platforms[0], follower_count: 100, engagement_rate: 0 }] }), true);
  assert.equal(matchesCreatorActivity({ ...empty, platforms: [{ ...empty.platforms[0], avg_views: 25 }] }), true);
  assert.equal(matchesCreatorActivity({ ...empty, platforms: [{ ...empty.platforms[0], follower_count: NaN, avg_views: Infinity }] }), false);
});

test("collecting usable metrics automatically changes an inactive creator to active", () => {
  const before = { ...neverEnriched(), metrics: {} as UnifiedCreatorResult["metrics"] };
  const after = { ...before, enrichment_status: "enriched" as const,
    platforms: [{ ...before.platforms[0], follower_count: 1250 }] };
  assert.equal(matchesCreatorActivity(before, "inactive"), true);
  assert.equal(matchesCreatorActivity(after, "inactive"), false);
  assert.equal(matchesCreatorActivity(after, "active"), true);
  assert.equal(matchesCreatorActivity(after, "all"), true);
});
