import assert from "node:assert/strict";

import {
  pickApifyPreviewImageUrl,
  pickApifyTikTokCoverUrls,
} from "@/lib/performance/apify-preview-image";

const TT_COVER =
  "https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/cover.jpeg?x-expires=9999999999&x-signature=abc";
const TT_ORIGIN =
  "https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/origin.jpeg?x-expires=9999999999&x-signature=def";

assert.equal(
  pickApifyPreviewImageUrl({
    playCount: 1000,
    videoMeta: { coverUrl: TT_COVER },
  }),
  TT_COVER,
  "videoMeta.coverUrl"
);

assert.equal(
  pickApifyPreviewImageUrl({
    playCount: 1000,
    videoMeta: { originalCoverUrl: TT_ORIGIN, coverUrl: TT_COVER },
  }),
  TT_ORIGIN,
  "prefer videoMeta.originalCoverUrl"
);

assert.equal(
  pickApifyPreviewImageUrl({
    playCount: 1000,
    covers: { dynamic: TT_COVER },
  }),
  TT_COVER,
  "covers.dynamic"
);

assert.deepEqual(
  pickApifyTikTokCoverUrls({
    videoMeta: { coverUrl: TT_COVER },
    dynamicCover: TT_ORIGIN,
  }),
  [TT_COVER, TT_ORIGIN],
  "collect all TikTok cover candidates"
);

assert.equal(
  pickApifyPreviewImageUrl({ displayUrl: "https://cdninstagram.com/x.jpg" }),
  "https://cdninstagram.com/x.jpg",
  "Instagram displayUrl unchanged"
);

console.log("apify-preview-image tests passed");
