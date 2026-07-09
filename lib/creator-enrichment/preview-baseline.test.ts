import assert from "node:assert/strict";
import test from "node:test";

import {
  accountHasUsableBaselineData,
  accountsHaveUsableBaselineData,
} from "./preview-baseline";

test("accountHasUsableBaselineData detects follower preview", () => {
  assert.equal(accountHasUsableBaselineData({ follower_count: 761000 }), true);
});

test("accountHasUsableBaselineData detects profile preview without followers", () => {
  assert.equal(
    accountHasUsableBaselineData({
      follower_count: 0,
      profile_display_name: "By DoniaElserafy",
      profile_picture_url: "https://example.com/avatar.jpg",
    }),
    true
  );
});

test("accountHasUsableBaselineData rejects handle-only shell accounts", () => {
  assert.equal(
    accountHasUsableBaselineData({
      follower_count: 0,
      profile_display_name: "hebanagi5",
      handle: "@hebanagi5",
    }),
    false
  );
});

test("accountsHaveUsableBaselineData is true when any account has preview", () => {
  assert.equal(
    accountsHaveUsableBaselineData([
      { follower_count: 0 },
      { follower_count: 1200, profile_display_name: "Creator" },
    ]),
    true
  );
});
