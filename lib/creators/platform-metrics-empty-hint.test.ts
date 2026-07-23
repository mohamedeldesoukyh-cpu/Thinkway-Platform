import assert from "node:assert/strict";
import test from "node:test";

import { resolvePlatformMetricsEmptyHint } from "./platform-metrics-empty-hint";
import type { UnifiedCreatorPlatform } from "./types";

function platform(
  overrides: Partial<UnifiedCreatorPlatform> = {}
): UnifiedCreatorPlatform {
  return {
    id: "pa-1",
    platform: "snapchat",
    handle: "creator",
    profile_url: "https://snapchat.com/add/creator",
    follower_count: null,
    engagement_rate: null,
    avg_views: null,
    audience_country: null,
    ...overrides,
  };
}

test("returns null when platform has displayable metrics", () => {
  assert.equal(
    resolvePlatformMetricsEmptyHint(platform({ follower_count: 12_000 })),
    null
  );
});

test("shows enriching hint while sync is in flight", () => {
  assert.equal(
    resolvePlatformMetricsEmptyHint(platform({ enrichment_status: "running" })),
    "Enriching…"
  );
});

test("shows snapchat not configured when sync error mentions actor", () => {
  assert.equal(
    resolvePlatformMetricsEmptyHint(
      platform({ sync_error: "Snapchat Apify actor id not configured" })
    ),
    "Snapchat enrichment not configured"
  );
});

test("shows snapchat not enriched yet for never status", () => {
  assert.equal(
    resolvePlatformMetricsEmptyHint(platform({ enrichment_status: "never" })),
    "Snapchat not enriched yet"
  );
});

test("shows generic enrichment failed for other platforms", () => {
  assert.equal(
    resolvePlatformMetricsEmptyHint(
      platform({
        platform: "instagram",
        enrichment_status: "failed",
        sync_status: "failed",
      })
    ),
    "Enrichment failed"
  );
});
