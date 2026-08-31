import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  fetchPublicationPreviewImage,
  isAllowedPublicationPreviewPostUrl,
  isAllowedPublicationPreviewSrcUrl,
  refererForPublicationImageUrl,
  resolvePublicationPreviewForHttpRequest,
} from "./publication-preview-proxy";
import { instagramShortcodeFromUrl } from "@/lib/performance/screenshot-capture/providers/instagram-media-redirect";
import { youtubeVideoIdFromUrl } from "@/lib/performance/screenshot-capture/providers/youtube-thumbnail";
import {
  getMediaProxyMetrics,
  mediaProxyCacheKey,
  resetMediaProxyMetricsForTests,
  setMediaProxyCachePositive,
} from "@/lib/creators/media-proxy-cache";
import { imageLongestEdge } from "@/lib/io/compress-export-image";

async function jpegOfSize(
  width: number,
  height: number,
  quality = 90
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f4c7b0"/>
        <stop offset="0.55" stop-color="#8ec5e8"/>
        <stop offset="1" stop-color="#f7e7c6"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${Math.round(width * 0.32)}" cy="${Math.round(height * 0.38)}" r="${Math.round(width * 0.22)}" fill="#c08050"/>
    <circle cx="${Math.round(width * 0.7)}" cy="${Math.round(height * 0.62)}" r="${Math.round(width * 0.16)}" fill="#80c070"/>
    <rect x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.72)}" width="${Math.round(width * 0.8)}" height="${Math.round(height * 0.12)}" fill="#f2d27a"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality, chromaSubsampling: "4:4:4" }).toBuffer();
}

async function main() {
  assert.equal(
    isAllowedPublicationPreviewSrcUrl(
      "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=123"
    ),
    true,
    "Instagram OG images on fbsbx.com must be fetchable"
  );

  assert.equal(
    isAllowedPublicationPreviewSrcUrl("https://scontent.cdninstagram.com/v/t51.jpg"),
    true
  );
  assert.equal(
    isAllowedPublicationPreviewSrcUrl("https://img.youtube.com/vi/dQw4w9wgGcQ/hqdefault.jpg"),
    true
  );
  assert.equal(
    isAllowedPublicationPreviewSrcUrl("https://p16-sign-va.tiktokcdn.com/tos/cover.jpeg"),
    true
  );
  assert.equal(
    isAllowedPublicationPreviewSrcUrl(
      "https://p16-common-sign.tiktokcdn-eu.com/tos-maliva-p-0068/cover~tplv-tiktokx-origin.image"
    ),
    true,
    "regional TikTok CDNs must be fetchable for stored origin covers"
  );
  assert.equal(
    isAllowedPublicationPreviewSrcUrl("https://scontent.xx.fbcdn.net/v/t15/fb.jpg"),
    true
  );
  assert.equal(
    isAllowedPublicationPreviewSrcUrl(
      "https://cf-st.sc-cdn.net/aps/bolt/aHR0cHM6Ly9jZi1zdC5zYy1jZG4ubmV0L2Qvavatar"
    ),
    true,
    "Snapchat CDN avatars must be fetchable"
  );
  assert.equal(
    refererForPublicationImageUrl("https://cf-st.sc-cdn.net/aps/bolt/avatar"),
    "https://www.snapchat.com/"
  );
  assert.equal(
    isAllowedPublicationPreviewPostUrl("https://www.snapchat.com/add/fsmand1"),
    true
  );

  assert.equal(
    isAllowedPublicationPreviewSrcUrl("https://notinstagram.com/v/t51.jpg"),
    false,
    "substring lookalike hosts must be rejected"
  );
  assert.equal(
    isAllowedPublicationPreviewSrcUrl("https://127.0.0.1/secret.jpg"),
    false
  );
  assert.equal(
    isAllowedPublicationPreviewPostUrl("https://evil-instagram.com/p/abc/"),
    false
  );

  assert.equal(
    isAllowedPublicationPreviewPostUrl("https://www.tiktok.com/@creator/video/123"),
    true
  );
  assert.equal(
    isAllowedPublicationPreviewPostUrl("https://www.youtube.com/watch?v=dQw4w9wgGcQ"),
    true
  );
  assert.equal(
    isAllowedPublicationPreviewPostUrl("https://www.facebook.com/reel/1234567890123456"),
    true
  );
  assert.equal(
    isAllowedPublicationPreviewPostUrl("https://fb.watch/abc123/"),
    true
  );

  const fbMiss = await resolvePublicationPreviewForHttpRequest({
    src: null,
    postUrl: "https://www.facebook.com/reel/1234567890123456",
  });
  assert.equal(fbMiss.ok, false);
  if (!fbMiss.ok) {
    assert.equal(fbMiss.source, "miss");
    assert.equal(fbMiss.needsRefresh, true, "Facebook posts must schedule background preview refresh");
  }

  const ytMiss = await resolvePublicationPreviewForHttpRequest({
    src: null,
    postUrl: "https://www.youtube.com/watch?v=dQw4w9wgGcQ",
  });
  assert.equal(ytMiss.ok, false);
  if (!ytMiss.ok) {
    assert.equal(ytMiss.needsRefresh, true, "YouTube posts must schedule background preview refresh");
  }

  const ttMiss = await resolvePublicationPreviewForHttpRequest({
    src: null,
    postUrl: "https://www.tiktok.com/@creator/video/123",
  });
  assert.equal(ttMiss.ok, false);
  if (!ttMiss.ok) {
    assert.equal(ttMiss.needsRefresh, true, "TikTok posts must schedule background preview refresh");
  }

  assert.equal(instagramShortcodeFromUrl("https://www.instagram.com/p/DaIquJuMyax/"), "DaIquJuMyax");
  assert.equal(instagramShortcodeFromUrl("https://www.instagram.com/reel/DaIquJuMyax/"), "DaIquJuMyax");
  assert.equal(youtubeVideoIdFromUrl("https://www.youtube.com/watch?v=dQw4w9wgGcQ"), "dQw4w9wgGcQ");
  assert.equal(youtubeVideoIdFromUrl("https://youtu.be/dQw4w9wgGcQ"), "dQw4w9wgGcQ");
  assert.equal(youtubeVideoIdFromUrl("https://www.youtube.com/shorts/abc123xyz"), "abc123xyz");

  {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "publication-preview-proxy.ts"),
      "utf8"
    );
    assert.match(source, /stabilizeTikTokAvatarUrl/, "reuse existing TikTok URL stabilizer");
    assert.match(source, /MIN_SHARP_PUBLICATION_EDGE/, "reject undersized publication bytes");
    assert.doesNotMatch(source, /createPublicationImageSso|publication-image-ssot/);
  }

  resetMediaProxyMetricsForTests();
  const src = "https://scontent.cdninstagram.com/v/cached-preview.jpg";
  const key = mediaProxyCacheKey({ kind: "preview", src, postUrl: null });
  setMediaProxyCachePositive(key, new Uint8Array([1]).buffer, "image/jpeg");
  const cached = await resolvePublicationPreviewForHttpRequest({ src });
  assert.equal(cached.ok, true);
  if (cached.ok) assert.equal(cached.source, "cache");
  assert.equal(getMediaProxyMetrics().externalRequests, 0);

  const miss = await resolvePublicationPreviewForHttpRequest({
    src: null,
    postUrl: "https://www.instagram.com/p/OnlyPostUrl/",
  });
  assert.equal(miss.ok, false);
  if (!miss.ok) {
    assert.equal(miss.source, "miss");
    assert.equal(miss.needsRefresh, true);
  }

  {
    resetMediaProxyMetricsForTests();
    const tinySrc =
      "https://scontent.cdninstagram.com/v/t51.82787-15/full.jpg?oe=ABCDEF12";
    const postUrl = "https://www.instagram.com/p/DaIquJuMyax/";
    const largeCdn = "https://scontent.cdninstagram.com/v/t51.82787-15/large.jpg";
    const tiny = await jpegOfSize(150, 150);
    const large = await jpegOfSize(1080, 1080);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === tinySrc) {
        return new Response(tiny, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (url.includes("/media/?size=l")) {
        return new Response(null, {
          status: 302,
          headers: { location: largeCdn },
        });
      }
      if (url === largeCdn) {
        return new Response(large, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const result = await fetchPublicationPreviewImage({ src: tinySrc, postUrl });
      assert.equal(result.ok, true, "tiny stored thumb should upgrade via Instagram media redirect");
      if (result.ok) {
        const edge = await imageLongestEdge(result.buffer);
        assert.ok(edge >= 1000, `expected ~1080px source, got ${edge}`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  {
    resetMediaProxyMetricsForTests();
    const posterizedSrc =
      "https://scontent.cdninstagram.com/v/t51.82787-15/full.jpg?oh=abc&oe=ABCDEF12";
    const postUrl = "https://www.instagram.com/p/PosterizedShot/";
    const largeCdn = "https://scontent.cdninstagram.com/v/t51.82787-15/photographic.jpg";
    const posterized = await jpegOfSize(1080, 1080, 8);
    const photographic = await jpegOfSize(1080, 1080, 90);
    const fetchedUrls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchedUrls.push(url);
      if (url === posterizedSrc) {
        return new Response(posterized, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (url.includes("/media/?size=l")) {
        return new Response(null, {
          status: 302,
          headers: { location: largeCdn },
        });
      }
      if (url === largeCdn) {
        return new Response(photographic, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const result = await fetchPublicationPreviewImage({ src: posterizedSrc, postUrl });
      assert.equal(
        result.ok,
        true,
        "1080px e15-class JPEG must not win; media redirect photographic JPEG should be used"
      );
      if (result.ok) {
        assert.equal(
          result.buffer.byteLength,
          photographic.byteLength,
          "embedded bytes must be the photographic JPEG, not the posterized src"
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  {
    resetMediaProxyMetricsForTests();
    const e15Src =
      "https://scontent.cdninstagram.com/v/t51.82787-15/full.jpg?stp=dst-jpg_e15_s640x640";
    const fetchedUrls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchedUrls.push(url);
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const result = await fetchPublicationPreviewImage({ src: e15Src, postUrl: null });
      assert.equal(result.ok, false, "unsigned e15 must not be embedded when rewrite fails");
      assert.equal(
        fetchedUrls.includes(e15Src),
        false,
        "original e15 URL must never be fetched as a fallback"
      );
      assert.ok(
        fetchedUrls.some((url) => url.includes("e35")),
        "unsigned e15 should attempt an e35 rewrite before giving up"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  {
    resetMediaProxyMetricsForTests();
    const tinySrc = "https://scontent.cdninstagram.com/v/t51.2885-15/s320x320/tiny.jpg";
    const tiny = await jpegOfSize(300, 300);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("scontent.cdninstagram.com")) {
        return new Response(tiny, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const result = await fetchPublicationPreviewImage({ src: tinySrc, postUrl: null });
      assert.equal(
        result.ok,
        false,
        "a ~300px thumbnail must not be treated as a Showcase publication source"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  {
    resetMediaProxyMetricsForTests();
    const signedSrc =
      "https://p16-common-sign.tiktokcdn-eu.com/tos-maliva-p-0068/cover~tplv-tiktokx-origin.image?x-expires=1&x-signature=expired";
    const postUrl = "https://www.tiktok.com/@ouda.5/video/7307222111527931141";
    const oembedCover =
      "https://p16-common.tiktokcdn.com/tos-maliva-p-0068/cover~tplv-tiktokx-origin.image?x-signature=fresh";
    const origin = await jpegOfSize(960, 1708);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://www.tiktok.com/oembed")) {
        return Response.json({ thumbnail_url: oembedCover });
      }
      if (url === oembedCover || url.startsWith("https://p16-common.tiktokcdn.com/")) {
        return new Response(origin, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response(null, { status: 403 });
    }) as typeof fetch;

    try {
      const result = await fetchPublicationPreviewImage({ src: signedSrc, postUrl });
      assert.equal(
        result.ok,
        true,
        "expired signed TikTok origin must upgrade via oEmbed, not a tiny OG thumb"
      );
      if (result.ok) {
        const edge = await imageLongestEdge(result.buffer);
        assert.ok(edge >= 960, `expected oEmbed origin cover, got ${edge}`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  if (process.env.RUN_LIVE_PUBLICATION_PREVIEW_TESTS === "1") {
    const result = await fetchPublicationPreviewImage({
      src: "https://scontent.cdninstagram.com/v/expired-thumb.jpg",
      postUrl: "https://www.instagram.com/p/DaIquJuMyax/",
    });
    assert.equal(result.ok, true, "Expired CDN should recover via Instagram media redirect");
    if (result.ok) {
      assert.ok(result.buffer.byteLength > 10_000);
      assert.equal(result.contentType, "image/jpeg");
    }
  }

  console.log("publication-preview-proxy tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
