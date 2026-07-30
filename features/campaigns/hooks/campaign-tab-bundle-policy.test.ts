import assert from "node:assert/strict";

import {
  TAB_BLOCKING_BUNDLES,
  TAB_ERROR_BUNDLES,
} from "@/features/campaigns/hooks/campaign-tab-bundle-policy";

// DEF-R21-01: finance audit must not block or replace the Timeline tab.
assert.deepEqual(TAB_BLOCKING_BUNDLES.timeline, []);
assert.deepEqual(TAB_ERROR_BUNDLES.timeline, []);
assert.ok(!TAB_BLOCKING_BUNDLES.timeline.includes("financeAudit" as never));
assert.ok(!TAB_ERROR_BUNDLES.timeline.includes("financeAudit" as never));

// Billing / publications still block on their own bundles.
assert.deepEqual(TAB_BLOCKING_BUNDLES.billing, ["billing"]);
assert.deepEqual(TAB_BLOCKING_BUNDLES.publications, ["publications"]);

console.log("campaign-tab-bundle-policy tests passed");
