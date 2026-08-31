import assert from "node:assert/strict";

import {
  MAX_PENDING_STREAK_BEFORE_ACTIVE,
  MAX_POLL_ATTEMPTS,
  MAX_POLL_MS,
  isActiveSyncStatus,
  isTerminalSyncStatus,
  pollGiveUpStatus,
  shouldAbortOpaquePending,
} from "./poll-creator-refresh-policy";

assert.equal(isTerminalSyncStatus("completed"), true);
assert.equal(isTerminalSyncStatus("failed"), true);
assert.equal(isTerminalSyncStatus("queued"), false);
assert.equal(isActiveSyncStatus("queued"), true);
assert.equal(isActiveSyncStatus("collecting"), true);
assert.equal(isActiveSyncStatus("pending"), false);

assert.equal(pollGiveUpStatus("queued"), "queued", "do not toast failure while still queued");
assert.equal(pollGiveUpStatus("collecting"), "collecting");
assert.equal(pollGiveUpStatus("pending"), "failed");
assert.equal(pollGiveUpStatus(null), "failed");
assert.equal(
  pollGiveUpStatus("pending", true),
  "queued",
  "after a job was seen in flight, pending at give-up is still running"
);

assert.equal(
  shouldAbortOpaquePending({ seenActive: false, pendingStreak: MAX_PENDING_STREAK_BEFORE_ACTIVE }),
  true,
  "abort only before the job is visible"
);
assert.equal(
  shouldAbortOpaquePending({
    seenActive: true,
    pendingStreak: MAX_PENDING_STREAK_BEFORE_ACTIVE + 10,
  }),
  false,
  "opaque pending after queued/collecting is a blip, not a dead worker"
);
assert.equal(
  shouldAbortOpaquePending({ seenActive: false, pendingStreak: MAX_PENDING_STREAK_BEFORE_ACTIVE - 1 }),
  false
);

assert.ok(
  MAX_POLL_MS >= 4 * 60 * 1000,
  "poll window must cover typical live Apify profile duration"
);
assert.ok(MAX_POLL_ATTEMPTS >= 80);

console.log("poll-creator-refresh.test.ts: ok");
