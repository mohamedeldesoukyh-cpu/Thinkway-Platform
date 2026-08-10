import assert from "node:assert/strict";

import {
  coerceDeliverableTypeForPlatform,
  getDeliverableTypeCodesForPlatform,
  inferDeliverableTypeFromContentUrl,
} from "@/lib/campaigns/deliverable-taxonomy";

const fbTypes = getDeliverableTypeCodesForPlatform("facebook");
assert.ok(fbTypes.includes("facebook_post"));
assert.ok(fbTypes.includes("facebook_reel"));
assert.ok(fbTypes.includes("facebook_story"));
assert.ok(!fbTypes.includes("other"), "Facebook should use real types, not only Other");

assert.equal(
  inferDeliverableTypeFromContentUrl("https://www.facebook.com/reel/1849794332663999"),
  "facebook_reel"
);
assert.equal(
  inferDeliverableTypeFromContentUrl("https://www.facebook.com/watch/?v=123"),
  "facebook_post"
);
assert.equal(
  inferDeliverableTypeFromContentUrl("https://www.instagram.com/reel/AbCdEf/"),
  "instagram_reel"
);

assert.equal(
  coerceDeliverableTypeForPlatform(
    "facebook",
    "instagram_post",
    "https://www.facebook.com/reel/1849794332663999"
  ),
  "facebook_reel",
  "lingering IG type on FB URL must coerce to FB reel"
);

assert.equal(
  coerceDeliverableTypeForPlatform("facebook", "facebook_story", null),
  "facebook_story",
  "valid FB type must be preserved"
);

console.log("lib/campaigns/deliverable-taxonomy.facebook.test.ts — all tests passed");
