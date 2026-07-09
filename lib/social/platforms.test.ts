import assert from "node:assert/strict";

import { normalizeProfileUrl } from "@/lib/social/platforms";

assert.equal(
  normalizeProfileUrl("https://www.facebook.com/profile.php?id=123456789"),
  "https://www.facebook.com/profile.php?id=123456789"
);

assert.equal(
  normalizeProfileUrl("https://www.facebook.com/profile.php?id=100090186279"),
  "https://www.facebook.com/profile.php?id=100090186279"
);

assert.notEqual(
  normalizeProfileUrl("https://www.facebook.com/profile.php?id=123456789"),
  normalizeProfileUrl("https://www.facebook.com/profile.php?id=100090186279"),
  "distinct Facebook profile ids must not normalize to the same URL"
);

assert.equal(
  normalizeProfileUrl("https://www.facebook.com/zuck"),
  "https://www.facebook.com/zuck"
);

assert.equal(
  normalizeProfileUrl("https://www.instagram.com/jane.doe/?utm_source=foo"),
  "https://www.instagram.com/jane.doe"
);

console.log("lib/social/platforms.test.ts — all tests passed");
