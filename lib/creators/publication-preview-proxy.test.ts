import assert from "node:assert/strict";

import { fetchPublicationPreviewImage, isAllowedPublicationPreviewSrcUrl } from "./publication-preview-proxy";
import { instagramShortcodeFromUrl } from "@/lib/performance/screenshot-capture/providers/instagram-media-redirect";

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
