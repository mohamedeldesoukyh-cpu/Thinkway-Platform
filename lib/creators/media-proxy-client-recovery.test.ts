import assert from "node:assert/strict";

import {
  isMediaProxyApiUrl,
  maxMediaProxyClientRetries,
  mediaProxyRetryDelayMs,
  withMediaProxyRetryBust,
} from "@/lib/creators/media-proxy-client-recovery";

assert.equal(isMediaProxyApiUrl("/api/creators/avatar?src=x"), true);
assert.equal(isMediaProxyApiUrl("/api/creators/publication-preview?src=x"), true);
assert.equal(isMediaProxyApiUrl("https://cdn.example/a.jpg"), false);

assert.equal(
  withMediaProxyRetryBust("/api/creators/avatar?src=https%3A%2F%2Fx", 1),
  "/api/creators/avatar?src=https%3A%2F%2Fx&_twr=1"
);
assert.equal(
  withMediaProxyRetryBust("/api/creators/publication-preview?postUrl=p", 2).includes("_twr=2"),
  true
);
assert.equal(withMediaProxyRetryBust("https://cdn.example/a.jpg", 1), "https://cdn.example/a.jpg");

assert.equal(mediaProxyRetryDelayMs(0), 900);
assert.equal(mediaProxyRetryDelayMs(2), 5000);
assert.equal(mediaProxyRetryDelayMs(3), null);
assert.equal(maxMediaProxyClientRetries(), 3);

console.log("lib/creators/media-proxy-client-recovery.test.ts — all tests passed");
