import assert from "node:assert/strict";

import { resolveAggregatedCreatorEnrichmentStatus } from "./status-resolution";

function resolve(
  storedStatus: string,
  platformStatuses: string[],
  hasInflightJob = false
) {
  return resolveAggregatedCreatorEnrichmentStatus({
    creatorId: "test-creator",
    storedStatus: storedStatus as never,
    platformStatuses: platformStatuses as never[],
    hasInflightJob,
    log: false,
  });
}

assert.equal(
  resolve("enriched", ["enriched", "never"]),
  "enriched",
  "IG enriched + TikTok never stays Updated"
);

assert.equal(
  resolve("queued", ["enriched", "never"], false),
  "enriched",
  "orphaned creator queued with IG done reconciles to Updated"
);

assert.equal(
  resolve("enriched", ["enriched", "queued"], false),
  "enriched",
  "IG enriched + TikTok queued without job stays Updated"
);

assert.equal(
  resolve("queued", ["enriched", "never"], true),
  "queued",
  "active job keeps Queued while waiting"
);

assert.equal(
  resolve("running", ["enriched", "never"], true),
  "running",
  "active running job shows Updating"
);

assert.equal(
  resolve("never", ["never", "never"]),
  "never",
  "all platforms never → Never synced"
);

assert.equal(
  resolve("enriched", ["enriched", "failed"]),
  "partial",
  "mixed success and failure → Partial failure"
);

assert.equal(
  resolve("failed", ["failed", "never"]),
  "failed",
  "all failed platforms → failed"
);

assert.equal(
  resolve("failed", ["enriched", "never"], false),
  "failed",
  "latest refresh failed beats historical platform enriched (no false completed)"
);

assert.equal(
  resolve("failed", ["enriched", "enriched"], true),
  "queued",
  "in-flight job still shows queued even when stored failed briefly"
);

assert.equal(
  resolve("queued", ["never", "never"], false),
  "never",
  "orphaned queued with no completions → never"
);

assert.equal(
  resolve("awaiting_profile_details", ["awaiting_profile_details"], false),
  "awaiting_profile_details",
  "awaiting profile-details stays staged incomplete"
);

assert.equal(
  resolve("enriched", ["awaiting_profile_details", "never"], false),
  "awaiting_profile_details",
  "platform awaiting without completed peers stays awaiting"
);

console.log("status-resolution.test.ts: all tests passed");
