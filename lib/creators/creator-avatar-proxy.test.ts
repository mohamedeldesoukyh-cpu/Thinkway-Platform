import assert from "node:assert/strict";
import test from "node:test";

import {
  isAllowedCreatorAvatarProfileUrl,
  resolveCreatorAvatarForHttpRequest,
} from "@/lib/creators/creator-avatar-proxy";
import {
  getMediaProxyMetrics,
  resetMediaProxyMetricsForTests,
  setMediaProxyCachePositive,
  mediaProxyCacheKey,
} from "@/lib/creators/media-proxy-cache";

test("isAllowedCreatorAvatarProfileUrl accepts instagram and tiktok profiles", () => {
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://www.instagram.com/mohamed.farag/"), true);
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://www.tiktok.com/@creator"), true);
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://example.com/user"), false);
  assert.equal(
    isAllowedCreatorAvatarProfileUrl("https://notinstagram.com/user"),
    false,
    "substring lookalike hosts must be rejected"
  );
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://127.0.0.1/"), false);
});

test("embedded profile picture regex extracts instagram CDN urls", () => {
  const html =
    '"profile_pic_url_hd":"https:\\/\\/scontent.cdninstagram.com\\/v\\/fresh.jpg?oe=ABCDEF12"';
  const match = html.match(/"profile_pic_url_hd":"([^"]+)"/);
  assert.ok(match?.[1]);
  const decoded = match[1].replace(/\\\//g, "/");
  assert.match(decoded, /^https:\/\/scontent\.cdninstagram\.com/);
});

test("resolveCreatorAvatarForHttpRequest returns cached avatar without external fetch", async () => {
  resetMediaProxyMetricsForTests();
  const src = "https://scontent.cdninstagram.com/v/cached-avatar.jpg";
  const key = mediaProxyCacheKey({ kind: "avatar", src, profileUrl: null });
  const buffer = new Uint8Array([9, 9, 9]).buffer;
  setMediaProxyCachePositive(key, buffer, "image/jpeg");

  const beforeExternals = getMediaProxyMetrics().externalRequests;
  const result = await resolveCreatorAvatarForHttpRequest({ src });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, "cache");
    assert.equal(result.buffer.byteLength, 3);
  }
  assert.equal(getMediaProxyMetrics().externalRequests, beforeExternals);
});

test("resolveCreatorAvatarForHttpRequest misses instantly when no cache and no usable src", async () => {
  resetMediaProxyMetricsForTests();
  const result = await resolveCreatorAvatarForHttpRequest({
    src: null,
    profileUrl: "https://www.instagram.com/some.creator/",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.source, "miss");
    assert.equal(result.needsRefresh, true);
    assert.equal(result.status, 404);
  }
});

console.log("creator-avatar-proxy.test.ts: ok");
