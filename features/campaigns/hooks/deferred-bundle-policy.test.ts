import assert from "node:assert/strict";

import {
  isSilentDeferredBundleRefresh,
  shouldFetchDeferredBundle,
} from "@/features/campaigns/hooks/deferred-bundle-policy";

// Loaded bundle is skipped on normal fetch — explains stale grid after add publication.
assert.equal(shouldFetchDeferredBundle("loaded"), false);
assert.equal(shouldFetchDeferredBundle("loading"), false);

// Force reload bypasses the loaded guard — publications grid refresh after mutations.
assert.equal(shouldFetchDeferredBundle("loaded", { force: true }), true);
assert.equal(shouldFetchDeferredBundle("loading", { force: true }), true);

assert.equal(shouldFetchDeferredBundle("idle"), true);
assert.equal(shouldFetchDeferredBundle("error"), true);

// Background refresh keeps the grid visible while data reloads.
assert.equal(isSilentDeferredBundleRefresh("loaded", { force: true }), true);
assert.equal(isSilentDeferredBundleRefresh("idle", { force: true }), false);
assert.equal(isSilentDeferredBundleRefresh("loaded"), false);

console.log("deferred-bundle-policy tests passed");
