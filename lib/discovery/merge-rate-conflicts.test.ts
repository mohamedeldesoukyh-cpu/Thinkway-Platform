import assert from "node:assert/strict";
import test from "node:test";
import { findMergeRateConflicts, type MergeRateRow } from "./merge-rate-conflicts";

const row: MergeRateRow = { id: "a", influencer_id: "target", version_id: "v1", platform: "instagram", deliverable: "reel", price_type: "creator_cost", package_key: "", amount: 100, currency: "EGP", notes: "" };
test("prices overlap across creators only, including different amounts or currencies", () => {
  const source = { ...row, id: "b", influencer_id: "source", amount: 200, currency: "USD" };
  assert.equal(findMergeRateConflicts([row, source], "target", "source").length, 1);
  assert.equal(findMergeRateConflicts([row, { ...row, id: "c" }], "target", "source").length, 0);
});
test("different versions, deliverables and package options remain separate prices", () => {
  for (const change of [{ version_id: "v2" }, { deliverable: "story" }, { package_key: "other" }, { price_type: "client_price" }]) {
    assert.equal(findMergeRateConflicts([row, { ...row, id: "b", influencer_id: "source", ...change }], "target", "source").length, 0);
  }
});
