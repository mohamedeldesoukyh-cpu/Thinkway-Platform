import assert from "node:assert/strict";

import {
  classifyRefreshFailureStage,
  resolveManualRefreshToast,
} from "./refresh-failure-stage";

assert.equal(
  classifyRefreshFailureStage(
    "Apify acquisition rejected — daily budget usage could not be verified (fail-closed). Supabase client was null"
  ),
  "budget_verification"
);

assert.equal(
  classifyRefreshFailureStage("Apify dataset fetch failed (500)"),
  "dataset_retrieval"
);

assert.equal(
  classifyRefreshFailureStage("DNA bridge — Snapshot not found"),
  "dna_enrichment"
);

assert.equal(
  classifyRefreshFailureStage(null, "actor_launch"),
  "actor_launch"
);

const budgetToast = resolveManualRefreshToast({
  syncStatus: "failed",
  refreshSource: "live_apify",
  failureStage: "budget_verification",
  failureReason: "usage could not be verified",
});
assert.equal(budgetToast.title, "Budget verification failed");
assert.equal(budgetToast.tone, "error");
assert.ok(!/finished without new Apify/i.test(budgetToast.title));

const actorToast = resolveManualRefreshToast({
  syncStatus: "failed",
  refreshSource: "live_apify",
  failureReason: "No Apify actor configured for platform instagram.",
});
assert.equal(actorToast.title, "Actor launch failed");
assert.ok(!/Budget verification/i.test(actorToast.title));

const noChanges = resolveManualRefreshToast({
  syncStatus: "completed",
  refreshSource: "live_apify",
  enrichmentSource: null,
  enrichmentStatus: "failed",
});
assert.equal(noChanges.title, "No profile changes detected");
assert.ok(!/DISCOVERY_APIFY_MAX/i.test(noChanges.description ?? ""));

const success = resolveManualRefreshToast({
  syncStatus: "completed",
  refreshSource: "live_apify",
  enrichmentSource: "apify",
  enrichmentStatus: "enriched",
});
assert.equal(success.title, "Creator refreshed live from Apify");
assert.equal(success.tone, "success");

console.log("refresh-failure-stage.test.ts: all tests passed");
