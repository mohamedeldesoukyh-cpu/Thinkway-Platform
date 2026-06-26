import assert from "node:assert/strict";

import {
  classifyInstagramContentUrl,
  instagramMetricsUnsupportedReason,
  instagramUrlSupportsPublicMetrics,
  validateInstagramPublicationUrl,
} from "@/lib/performance/metrics-collector/instagram-content-url";

assert.equal(
  classifyInstagramContentUrl("https://www.instagram.com/reel/DXzJvONN2_K/"),
  "reel"
);
assert.equal(
  classifyInstagramContentUrl("https://www.instagram.com/reels/DXzJvONN2_K/"),
  "reel"
);
assert.equal(
  classifyInstagramContentUrl("https://www.instagram.com/p/DXywMywIwgb/"),
  "post"
);
assert.equal(
  classifyInstagramContentUrl("https://www.instagram.com/stories/highlights/18089846000264202/"),
  "highlight"
);
assert.equal(
  classifyInstagramContentUrl("https://www.instagram.com/stories/amiryoussef.official/1234567890/"),
  "story"
);

assert.equal(instagramUrlSupportsPublicMetrics("reel"), true);
assert.equal(instagramUrlSupportsPublicMetrics("post"), true);
assert.equal(instagramUrlSupportsPublicMetrics("highlight"), false);

assert.match(
  instagramMetricsUnsupportedReason("highlight") ?? "",
  /highlight/i
);

assert.equal(
  validateInstagramPublicationUrl(
    "instagram_reel",
    "https://www.instagram.com/stories/highlights/18089846000264202/"
  ),
  instagramMetricsUnsupportedReason("highlight")
);

assert.equal(
  validateInstagramPublicationUrl(
    "instagram_reel",
    "https://www.instagram.com/reel/DXzJvONN2_K/"
  ),
  null
);

console.log("instagram-content-url tests passed");
