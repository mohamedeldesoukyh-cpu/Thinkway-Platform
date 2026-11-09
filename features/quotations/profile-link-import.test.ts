import assert from "node:assert/strict";
import { test } from "node:test";
import { newProfileLinkSeeds } from "./profile-link-import";

test("retries and linked CRM/Discovery identities do not add another quotation row", () => {
  const existing = [{ unified_id: "old", profile_id: "profile-1", influencer_id: "vendor-1" }];
  assert.deepEqual(newProfileLinkSeeds([
    { unified_id: "old" }, { unified_id: "new-ref", profile_id: "profile-1" },
    { influencer_id: "vendor-1" }, { unified_id: "new", creator_name: "Synthetic" },
    { unified_id: "new" },
  ], existing), [{ unified_id: "new", creator_name: "Synthetic" }]);
  assert.equal(existing.length, 1);
});

test("missing identity fields do not falsely match unrelated creators", () => {
  assert.equal(newProfileLinkSeeds([{ profile_id: "p1" }, { profile_id: "p2" }], [{ influencer_id: "v1" }]).length, 2);
});
