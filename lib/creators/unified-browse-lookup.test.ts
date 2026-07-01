import assert from "node:assert/strict";

import {
  BROWSE_INFLUENCER_STATUSES,
  isExplicitInfluencerLookup,
  RESOLVABLE_INFLUENCER_STATUSES,
} from "@/lib/creators/unified-browse";

assert.deepEqual(BROWSE_INFLUENCER_STATUSES, ["active"]);
assert.ok(RESOLVABLE_INFLUENCER_STATUSES.includes("prospect"));

assert.equal(isExplicitInfluencerLookup({}, null), false);
assert.equal(isExplicitInfluencerLookup({}, undefined), false);
assert.equal(isExplicitInfluencerLookup({}, []), false);
assert.equal(isExplicitInfluencerLookup({ influencerId: "abc" }, null), true);
assert.equal(isExplicitInfluencerLookup({}, ["abc"]), true);

console.log("lib/creators/unified-browse-lookup.test.ts — all tests passed");
