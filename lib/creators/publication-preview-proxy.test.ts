import assert from "node:assert/strict";

import {
  fetchPublicationPreviewImage,
  isAllowedPublicationPreviewPostUrl,
  isAllowedPublicationPreviewSrcUrl,
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
    isAllowedPublicationPreviewSrcUrl("https://scontent.xx.fbcdn.net/v/t15/fb.jpg"),
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
