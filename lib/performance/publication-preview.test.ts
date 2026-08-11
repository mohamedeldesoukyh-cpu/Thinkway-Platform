import assert from "node:assert/strict";

import { resolveCampaignPublicationDisplayPreviewUrl } from "@/lib/performance/publication-preview";

assert.equal(
  resolveCampaignPublicationDisplayPreviewUrl({
    screenshot_url: "https://xxx.supabase.co/storage/v1/object/public/media/shot.jpg",
    thumbnail_url: null,
    content_url: "https://www.instagram.com/reel/AbC/",
  }),
  "https://xxx.supabase.co/storage/v1/object/public/media/shot.jpg"
);

const proxyOnly = resolveCampaignPublicationDisplayPreviewUrl({
  screenshot_url: null,
  thumbnail_url: null,
  content_url: "https://www.instagram.com/reel/AbC/",
});
assert.ok(proxyOnly?.startsWith("/api/creators/publication-preview?"));
assert.ok(proxyOnly?.includes("postUrl="));

assert.equal(
  resolveCampaignPublicationDisplayPreviewUrl({
    screenshot_url: null,
    thumbnail_url: null,
    content_url: null,
  }),
  null
);

console.log("publication-preview — all tests passed");
