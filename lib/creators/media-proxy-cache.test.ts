import assert from "node:assert/strict";
import test from "node:test";

import {
  getMediaProxyCache,
  getMediaProxyMetrics,
  mediaProxyCacheKey,
  resetMediaProxyMetricsForTests,
  setMediaProxyCacheNegative,
  setMediaProxyCachePositive,
  withMediaProxyInflight,
} from "@/lib/creators/media-proxy-cache";

test("mediaProxyCacheKey distinguishes avatar vs preview", () => {
  const a = mediaProxyCacheKey({ kind: "avatar", src: "https://x/a.jpg" });
  const p = mediaProxyCacheKey({ kind: "preview", src: "https://x/a.jpg" });
  assert.notEqual(a, p);
});

test("positive cache hit returns buffer and increments hits", () => {
  resetMediaProxyMetricsForTests();
  const key = mediaProxyCacheKey({ kind: "avatar", src: "https://cdn/test.jpg" });
  const buffer = new Uint8Array([1, 2, 3]).buffer;
  setMediaProxyCachePositive(key, buffer, "image/jpeg");

  const first = getMediaProxyCache(key);
  assert.ok(first?.ok);
  if (first?.ok) {
    assert.equal(first.contentType, "image/jpeg");
    assert.equal(first.buffer.byteLength, 3);
  }
  assert.equal(getMediaProxyMetrics().hits, 1);
  assert.equal(getMediaProxyMetrics().misses, 0);
});

test("negative cache hit increments negativeHits", () => {
  resetMediaProxyMetricsForTests();
  const key = mediaProxyCacheKey({ kind: "preview", postUrl: "https://instagram.com/p/x/" });
  setMediaProxyCacheNegative(key, 404);
  const entry = getMediaProxyCache(key);
  assert.ok(entry && !entry.ok);
  assert.equal(getMediaProxyMetrics().negativeHits, 1);
});

test("withMediaProxyInflight dedupes concurrent work", async () => {
  resetMediaProxyMetricsForTests();
  let runs = 0;
  const task = () =>
    withMediaProxyInflight("dedupe-test", async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 30));
      return "ok";
    });

  const [a, b] = await Promise.all([task(), task()]);
  assert.equal(a, "ok");
  assert.equal(b, "ok");
  assert.equal(runs, 1);
  assert.equal(getMediaProxyMetrics().inflightJoins, 1);
});

console.log("media-proxy-cache.test.ts: ok");
