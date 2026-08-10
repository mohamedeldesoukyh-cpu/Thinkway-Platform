import assert from "node:assert/strict";

import {
  classifyFacebookContentUrl,
  isFacebookDirectContentUrl,
  isFacebookPageProfileApifyActor,
} from "@/lib/performance/metrics-collector/facebook-content-url";
import {
  DEFAULT_FACEBOOK_CONTENT_APIFY_ACTOR_ID,
  resolveApifyRunInput,
} from "@/lib/performance/metrics-collector/providers/apify-input";

assert.equal(
  classifyFacebookContentUrl("https://www.facebook.com/reel/1849794332663999"),
  "reel"
);
assert.equal(
  classifyFacebookContentUrl("https://www.facebook.com/nasaearth/posts/123"),
  "post"
);
assert.equal(classifyFacebookContentUrl("https://www.facebook.com/nasaearth/"), "page");
assert.equal(isFacebookDirectContentUrl("https://www.facebook.com/reel/1"), true);
assert.equal(isFacebookDirectContentUrl("https://www.facebook.com/nasaearth/"), false);
assert.equal(isFacebookPageProfileApifyActor("apify/facebook-posts-scraper"), true);
assert.equal(isFacebookPageProfileApifyActor(DEFAULT_FACEBOOK_CONTENT_APIFY_ACTOR_ID), false);

{
  const ok = resolveApifyRunInput(
    "facebook",
    "https://www.facebook.com/reel/1849794332663999",
    DEFAULT_FACEBOOK_CONTENT_APIFY_ACTOR_ID
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.input, {
      postUrls: ["https://www.facebook.com/reel/1849794332663999"],
    });
  }
}

{
  const refused = resolveApifyRunInput(
    "facebook",
    "https://www.facebook.com/reel/1849794332663999",
    "apify/facebook-posts-scraper"
  );
  assert.equal(refused.ok, false);
  if (!refused.ok) {
    assert.equal(refused.errorCode, "unsupported_url");
    assert.equal(refused.actorInvoked, false);
  }
}

{
  const pagePost = resolveApifyRunInput(
    "facebook",
    "https://www.facebook.com/nasaearth/posts/pfbid123",
    DEFAULT_FACEBOOK_CONTENT_APIFY_ACTOR_ID
  );
  assert.equal(pagePost.ok, true);
  if (pagePost.ok) {
    assert.ok(Array.isArray((pagePost.input as { postUrls: string[] }).postUrls));
  }
}

console.log("lib/performance/metrics-collector/facebook-content-url.test.ts — all tests passed");
