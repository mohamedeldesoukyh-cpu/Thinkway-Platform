import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchCreatorAvatarImage,
  isAllowedCreatorAvatarProfileUrl,
  resolveCreatorAvatarForHttpRequest,
  unavatarSourcesForProfileUrl,
} from "@/lib/creators/creator-avatar-proxy";
import {
  getMediaProxyMetrics,
  resetMediaProxyMetricsForTests,
  setMediaProxyCacheNegative,
  setMediaProxyCachePositive,
  mediaProxyCacheKey,
} from "@/lib/creators/media-proxy-cache";

test("isAllowedCreatorAvatarProfileUrl accepts instagram and tiktok profiles", () => {
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://www.instagram.com/mohamed.farag/"), true);
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://www.tiktok.com/@creator"), true);
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://www.snapchat.com/add/fsmand1"), true);
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://example.com/user"), false);
  assert.equal(
    isAllowedCreatorAvatarProfileUrl("https://notinstagram.com/user"),
    false,
    "substring lookalike hosts must be rejected"
  );
  assert.equal(isAllowedCreatorAvatarProfileUrl("https://127.0.0.1/"), false);
});

test("unavatarSourcesForProfileUrl builds TikTok and Instagram lookups", () => {
  assert.deepEqual(unavatarSourcesForProfileUrl("https://www.tiktok.com/@rewlifts"), [
    "https://unavatar.io/tiktok/rewlifts?fallback=false",
  ]);
  assert.deepEqual(unavatarSourcesForProfileUrl("https://www.instagram.com/radwaadeeel/"), [
    "https://unavatar.io/instagram/radwaadeeel?fallback=false",
  ]);
  assert.deepEqual(unavatarSourcesForProfileUrl("https://www.snapchat.com/add/rewlifts"), []);
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

test("negative cache still allows warm retry when profileUrl can recover", async () => {
  resetMediaProxyMetricsForTests();
  const profileUrl = "https://www.instagram.com/radwaadeeel/";
  const key = mediaProxyCacheKey({ kind: "avatar", src: null, profileUrl });
  setMediaProxyCacheNegative(key, 404);

  const result = await resolveCreatorAvatarForHttpRequest({
    src: null,
    profileUrl,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.source, "cache");
    assert.equal(result.needsRefresh, true);
  }
});

test("fetchCreatorAvatarImage loads Thinkway creator-avatars public URLs", async () => {
  resetMediaProxyMetricsForTests();
  const src =
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/inf/instagram/creator.jpg";
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input) === src) {
      return new Response(jpeg, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    const result = await fetchCreatorAvatarImage({ src, profileUrl: null });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contentType, "image/jpeg");
      assert.equal(result.buffer.byteLength, 4);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchCreatorAvatarImage uses unavatar when TikTok profile scrape has no photo", async () => {
  resetMediaProxyMetricsForTests();
  const profileUrl = "https://www.tiktok.com/@rewlifts";
  const unavatarUrl = "https://unavatar.io/tiktok/rewlifts?fallback=false";
  const jpeg = new Uint8Array(80).fill(0xff);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input) === unavatarUrl) {
      return new Response(jpeg, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as typeof fetch;

  try {
    const result = await fetchCreatorAvatarImage({ src: null, profileUrl });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contentType, "image/jpeg");
      assert.equal(result.buffer.byteLength, 80);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log("creator-avatar-proxy.test.ts: ok");
