import assert from "node:assert/strict";

import {
  creatorRecentPublicationDisplayUrl,
  normalizeCreatorRecentPublications,
  recentPublicationsLackThumbnails,
  resolveCreatorRecentPublicationThumbnail,
  shouldProxyPublicationMediaUrl,
} from "@/lib/creators/recent-publication-thumb";

const IG_CDN =
  "https://scontent-lax3-2.cdninstagram.com/v/t51.82787-15/example.jpg?oe=6A482F56";
const SUPABASE =
  "https://abc.supabase.co/storage/v1/object/sign/campaign-publication-media/thumb.jpg";

assert.equal(
  resolveCreatorRecentPublicationThumbnail({ displayUrl: IG_CDN }),
  IG_CDN,
  "resolve displayUrl from raw Apify row"
);

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    url: "https://www.instagram.com/p/ABC/",
    thumbnail: IG_CDN,
  }),
  IG_CDN,
  "resolve normalized thumbnail field"
);

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    url: "https://www.instagram.com/p/ABC/",
    likes: 100,
    comments: 10,
  }),
  null,
  "no thumbnail when only metrics present"
);

assert.equal(shouldProxyPublicationMediaUrl(IG_CDN), true);
assert.equal(shouldProxyPublicationMediaUrl(SUPABASE), false);
assert.equal(
  shouldProxyPublicationMediaUrl(
    "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=123"
  ),
  true,
  "Instagram OG images on fbsbx.com must use proxy"
);

assert.match(
  creatorRecentPublicationDisplayUrl({
    url: "https://www.instagram.com/p/ABC/",
    thumbnail: IG_CDN,
  }) ?? "",
  /^\/api\/creators\/publication-preview\?/,
  "Instagram CDN uses proxy route"
);

assert.equal(
  creatorRecentPublicationDisplayUrl({ url: "https://www.instagram.com/p/ABC/" }),
  "/api/creators/publication-preview?postUrl=https%3A%2F%2Fwww.instagram.com%2Fp%2FABC%2F",
  "post URL alone uses proxy for OpenGraph fallback"
);

assert.equal(
  creatorRecentPublicationDisplayUrl({ thumbnail: SUPABASE }),
  SUPABASE,
  "Supabase storage URL loads directly"
);

assert.match(
  creatorRecentPublicationDisplayUrl({
    url: "https://www.instagram.com/p/ABC/",
    thumbnail: "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=123",
  }) ?? "",
  /^\/api\/creators\/publication-preview\?/,
  "fbsbx OG thumbnails use proxy route"
);

assert.equal(
  recentPublicationsLackThumbnails([
    { url: "https://www.instagram.com/p/1/", likes: 10, thumbnail: null },
  ]),
  true
);

assert.equal(
  recentPublicationsLackThumbnails([
    { url: "https://www.instagram.com/p/1/", thumbnail: IG_CDN },
  ]),
  false
);

const normalized = normalizeCreatorRecentPublications([
  {
    url: "https://www.instagram.com/p/ABC/",
    displayUrl: IG_CDN,
    likesCount: 788,
    commentsCount: 90,
    videoViewCount: 8000,
    timestamp: "2025-01-01T00:00:00.000Z",
    caption: "Test",
  },
]);

assert.equal(normalized.length, 1);
assert.equal(normalized[0]?.thumbnail, IG_CDN);
assert.equal(normalized[0]?.likes, 788);
assert.equal(normalized[0]?.views, 8000);

const TT_COVER =
  "https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/cover.jpeg?x-expires=9999999999&x-signature=abc";

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    webVideoUrl: "https://www.tiktok.com/@with.fatimma/video/7123456789012345678",
    videoMeta: { coverUrl: TT_COVER, originalCoverUrl: TT_COVER },
    playCount: 12_400,
    diggCount: 420,
  }),
  TT_COVER,
  "resolve TikTok videoMeta.coverUrl from raw Apify row"
);

assert.match(
  creatorRecentPublicationDisplayUrl({
    url: "https://www.tiktok.com/@with.fatimma/video/7123456789012345678",
    thumbnail: TT_COVER,
  }) ?? "",
  /^\/api\/creators\/publication-preview\?/,
  "TikTok CDN cover uses proxy route"
);

assert.match(
  creatorRecentPublicationDisplayUrl({
    url: "https://www.tiktok.com/@with.fatimma/video/7123456789012345678",
  }) ?? "",
  /postUrl=/,
  "TikTok post URL alone uses proxy for oEmbed fallback"
);

const tiktokNormalized = normalizeCreatorRecentPublications([
  {
    webVideoUrl: "https://www.tiktok.com/@with.fatimma/video/7123456789012345678",
    videoMeta: { coverUrl: TT_COVER },
    diggCount: 420,
    commentCount: 18,
    playCount: 12_400,
    createTimeISO: "2025-06-01T12:00:00.000Z",
    text: "Morning routine #beauty",
  },
]);

assert.equal(tiktokNormalized.length, 1);
assert.equal(tiktokNormalized[0]?.thumbnail, TT_COVER);
assert.equal(tiktokNormalized[0]?.url, "https://www.tiktok.com/@with.fatimma/video/7123456789012345678");
assert.equal(tiktokNormalized[0]?.likes, 420);
assert.equal(tiktokNormalized[0]?.views, 12_400);

console.log("recent-publication-thumb tests passed");
