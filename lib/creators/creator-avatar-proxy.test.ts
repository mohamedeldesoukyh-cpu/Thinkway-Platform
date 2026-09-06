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
import { imageLongestEdge } from "@/lib/io/compress-export-image";

async function jpegOfSize(width: number, height: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 80, b: 120 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

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

test("resolveCreatorAvatarForHttpRequest serves tiny import crops and flags upgrade", async () => {
  resetMediaProxyMetricsForTests();
  const src =
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/d843/instagram/eyadelmogy.jpg";
  const profileUrl = "https://www.instagram.com/eyadelmogy/";
  const tiny = new Uint8Array(4011).fill(0xff);
  tiny[0] = 0xff;
  tiny[1] = 0xd8;
  const blob = new Blob([tiny], { type: "image/jpeg" });
  const supabase = {
    storage: {
      from: () => ({
        download: async () => ({ data: blob, error: null }),
      }),
    },
  };

  const result = await resolveCreatorAvatarForHttpRequest({
    src,
    profileUrl,
    supabase: supabase as never,
  });
  assert.equal(
    result.ok,
    true,
    "HTTP path must serve a usable import crop instead of 404ing for upgrade"
  );
  if (result.ok) {
    assert.equal(result.source, "storage");
    assert.equal(result.needsRefresh, true);
    assert.equal(result.buffer.byteLength, tiny.byteLength);
  }
});

test("resolveCreatorAvatarForHttpRequest serves low-res CDN instead of 404ing for upgrade", async () => {
  resetMediaProxyMetricsForTests();
  const tinySrc = "https://scontent.cdninstagram.com/v/t51.2885-19/s150x150/http-ui.jpg";
  const profileUrl = "https://www.instagram.com/HttpUiTiny/";
  const tiny = await jpegOfSize(150, 150);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input) === tinySrc) {
      return new Response(tiny, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    const result = await resolveCreatorAvatarForHttpRequest({
      src: tinySrc,
      profileUrl,
    });
    assert.equal(
      result.ok,
      true,
      "HTTP path must serve a usable low-res CDN avatar instead of 404ing for upgrade"
    );
    if (result.ok) {
      assert.equal(result.source, "cdn");
      assert.equal(
        result.needsRefresh,
        true,
        "low-res CDN hit should still schedule background upgrade"
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchCreatorAvatarImage loads Thinkway creator-avatars public URLs", async () => {
  resetMediaProxyMetricsForTests();
  const src =
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/inf/instagram/creator.jpg";
  const jpeg = await jpegOfSize(320, 320);
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
      assert.equal(result.buffer.byteLength, jpeg.byteLength);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchCreatorAvatarImage uses unavatar when TikTok profile scrape has no photo", async () => {
  resetMediaProxyMetricsForTests();
  const profileUrl = "https://www.tiktok.com/@rewlifts";
  const jpeg = await jpegOfSize(320, 320);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("unavatar.io")) {
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
      assert.equal(result.buffer.byteLength, jpeg.byteLength);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchCreatorAvatarImage upgrades tiny CDN avatars via profile_pic_url_hd", async () => {
  resetMediaProxyMetricsForTests();
  const src =
    "https://scontent.cdninstagram.com/v/t51.2885-19/s150x150/avatar.jpg?oe=ABCDEF12";
  const profileUrl = "https://www.instagram.com/tasneemmohamedd00/";
  const hdUrl = "https://scontent.cdninstagram.com/v/t51.2885-19/hd.jpg";
  const tiny = await jpegOfSize(150, 150);
  const hd = await jpegOfSize(640, 640);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === src) {
      return new Response(tiny, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (url.includes("unavatar.io")) {
      return new Response(tiny, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (url.startsWith("https://www.instagram.com/tasneemmohamedd00")) {
      const embedded = hdUrl.replace(/\//g, "\\/");
      return new Response(`<html><script>"profile_pic_url_hd":"${embedded}"</script></html>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url === hdUrl) {
      return new Response(hd, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    const result = await fetchCreatorAvatarImage({ src, profileUrl });
    assert.equal(result.ok, true);
    if (result.ok) {
      const edge = await imageLongestEdge(result.buffer);
      assert.ok(edge >= 600, `expected HD avatar, got ${edge}px`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log("creator-avatar-proxy.test.ts: ok");
