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
    result: { ok: false, queued: false, message: "REDIS_URL missing." },
    unifiedId: "u1",
  }),
  { type: "error", message: "REDIS_URL missing." }
);

console.log("features/discovery/enrichment/manual-refresh-follow-up.test.ts — all tests passed");
