import assert from "node:assert/strict";

import { resolveManualRefreshFollowUp } from "./manual-refresh-follow-up";

assert.deepEqual(
  resolveManualRefreshFollowUp({
    result: { ok: true, queued: true, message: "Refresh queued." },
    unifiedId: "u1",
  }),
  { type: "poll" }
);

assert.deepEqual(
  resolveManualRefreshFollowUp({
    result: { ok: true, queued: true, message: "Refresh queued." },
    unifiedId: null,
  }),
  { type: "queued_without_unified_id" }
);

assert.deepEqual(
  resolveManualRefreshFollowUp({
    result: {
      ok: true,
      queued: false,
      message: "Enrichment already in progress.",
    },
    unifiedId: "u1",
  }),
  { type: "poll" }
);

assert.deepEqual(
  resolveManualRefreshFollowUp({
    result: {
      ok: true,
      queued: false,
      message: "Creator updated.",
      refreshSource: "cached_snapshot",
    },
    unifiedId: "u1",
  }),
  { type: "cached" }
);

assert.deepEqual(
  resolveManualRefreshFollowUp({
    result: {
      ok: true,
      queued: false,
      message: "Creator updated.",
      refreshSource: "live_apify",
    },
    unifiedId: "u1",
  }),
  { type: "completed" }
);

assert.deepEqual(
  resolveManualRefreshFollowUp({
    result: { ok: false, queued: false, message: "REDIS_URL missing." },
    unifiedId: "u1",
  }),
  { type: "error", message: "REDIS_URL missing." }
);

assert.deepEqual(
  resolveManualRefreshFollowUp({
    result: {
      ok: true,
      queued: false,
      skipped: true,
      message: "creator_already_fresh",
      refreshSource: "live_apify",
    },
    unifiedId: "u1",
  }),
  { type: "error", message: "creator_already_fresh" }
);

assert.deepEqual(
  resolveManualRefreshFollowUp({
    result: {
      ok: true,
      queued: false,
      skipped: true,
      message: "enrichment_already_in_progress",
    },
    unifiedId: "u1",
  }),
  { type: "poll" }
);

console.log("features/discovery/enrichment/manual-refresh-follow-up.test.ts — all tests passed");
