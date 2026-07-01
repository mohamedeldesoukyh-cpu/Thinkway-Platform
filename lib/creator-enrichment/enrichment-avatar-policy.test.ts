import assert from "node:assert/strict";

import {
  isAvatarEnrichmentScope,
  resolveApifyAvatarPersistOptions,
} from "@/lib/creator-enrichment/enrichment-avatar-policy";

assert.equal(isAvatarEnrichmentScope("all"), true);
assert.equal(isAvatarEnrichmentScope("avatar"), true);
assert.equal(isAvatarEnrichmentScope("metrics"), false);
assert.equal(isAvatarEnrichmentScope(undefined), true, "default scope is all");

assert.deepEqual(
  resolveApifyAvatarPersistOptions({
    scope: "metrics",
    force: true,
    bypassMetricsManualOverride: true,
    forceAvatarReplace: false,
  }),
  { forceSync: false, forceAvatarReplace: false },
  "shortlist Refresh Metrics: persist allowed, policy not bypassed"
);

assert.deepEqual(
  resolveApifyAvatarPersistOptions({
    scope: "avatar",
    force: true,
    bypassMetricsManualOverride: false,
    forceAvatarReplace: true,
  }),
  { forceSync: true, forceAvatarReplace: true },
  "Refresh Avatar: force policy bypass and replace"
);

assert.deepEqual(
  resolveApifyAvatarPersistOptions({
    scope: "all",
    force: true,
    bypassMetricsManualOverride: true,
    forceAvatarReplace: true,
  }),
  { forceSync: true, forceAvatarReplace: true },
  "Refresh All: full avatar sync"
);

console.log("enrichment-avatar-policy tests passed");
