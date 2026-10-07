import assert from "node:assert/strict";
import test from "node:test";
import { sameCreatorIdentity } from "./same-creator-identity";

test("late enrichment for A cannot replace active creator B or reopen a closed sheet", () => {
  const a = { unified_id: "inf:a", influencer_id: "a" };
  assert.equal(sameCreatorIdentity({ unified_id: "inf:b", influencer_id: "b" }, a), false);
  assert.equal(sameCreatorIdentity(null, a), false);
  assert.equal(sameCreatorIdentity(a, a), true);
});
test("promotion preserves identity but missing IDs never match unrelated creators", () => {
  assert.equal(sameCreatorIdentity({ unified_id: "disc:a", discovered_profile_id: "a" }, { unified_id: "inf:b", discovered_profile_id: "a" }), true);
  assert.equal(sameCreatorIdentity({ unified_id: "a", influencer_id: null }, { unified_id: "b", influencer_id: null }), false);
});
