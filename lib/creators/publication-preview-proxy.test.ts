import assert from "node:assert/strict";

import {
  fetchPublicationPreviewImage,
  isAllowedPublicationPreviewSrcUrl,
  resolvePublicationPreviewForHttpRequest,
} from "./publication-preview-proxy";
import { instagramShortcodeFromUrl } from "@/lib/performance/screenshot-capture/providers/instagram-media-redirect";
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

  assert.equal(instagramShortcodeFromUrl("https://www.instagram.com/p/DaIquJuMyax/"), "DaIquJuMyax");
  assert.equal(instagramShortcodeFromUrl("https://www.instagram.com/reel/DaIquJuMyax/"), "DaIquJuMyax");

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
