import assert from "node:assert/strict";
import test from "node:test";

import { shouldIncludeApifyProfilePosts } from "./apify-fetch-policy";

test("no enrichment scope launches a separate Instagram posts actor", () => {
  assert.equal(shouldIncludeApifyProfilePosts("metrics"), false);
  assert.equal(shouldIncludeApifyProfilePosts("all"), false);
  assert.equal(shouldIncludeApifyProfilePosts("categories"), false);
  assert.equal(shouldIncludeApifyProfilePosts("avatar"), false);
  assert.equal(shouldIncludeApifyProfilePosts("profile"), false);
  assert.equal(shouldIncludeApifyProfilePosts("audience"), false);
  assert.equal(shouldIncludeApifyProfilePosts(undefined), false);
});
