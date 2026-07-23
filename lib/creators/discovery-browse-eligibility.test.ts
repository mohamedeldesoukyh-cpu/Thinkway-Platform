import assert from "node:assert/strict";

import {
  buildDiscoveryBrowseVisibilityPatch,
  type EnsureDiscoveryCreatorBrowsableResult,
} from "@/lib/creators/discovery-browse-eligibility";

const NOW = "2026-07-18T12:00:00.000Z";

assert.deepEqual(buildDiscoveryBrowseVisibilityPatch({ status: "active" }, { nowIso: NOW }), {
  updated_at: NOW,
});

assert.deepEqual(buildDiscoveryBrowseVisibilityPatch({ status: "prospect" }, { nowIso: NOW }), {
  status: "active",
  updated_at: NOW,
});

assert.equal(
  buildDiscoveryBrowseVisibilityPatch({ status: "active" }, { touchRecency: false }),
  null
);

assert.deepEqual(
  buildDiscoveryBrowseVisibilityPatch({ status: "prospect" }, { touchRecency: false }),
  { status: "active" }
);

console.log("lib/creators/discovery-browse-eligibility.test.ts — all tests passed");
