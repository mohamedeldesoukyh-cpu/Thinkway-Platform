import assert from "node:assert/strict";

import {
  creatorRecentPublicationDisplayUrl,
  higherResolutionSocialImageUrlCandidates,
  isCreatorRecentPublicationVideo,
  isLikelyLowResolutionSocialThumb,
  isVideoPublicationUrl,
  normalizeCreatorRecentPublications,
  preferHigherResolutionSocialImageUrl,
  recentPublicationsLackThumbnails,
  resolveCreatorRecentPublicationThumbnail,
  shouldProxyPublicationMediaUrl,
  socialCdnUrlLooksSigned,
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
    url: "https://www.youtube.com/watch?v=dQw4w9wgGcQ",
  }) ?? "",
  /postUrl=/,
  "YouTube post URL alone uses proxy for thumbnail fallback"
);

assert.match(
  creatorRecentPublicationDisplayUrl({
    url: "https://www.facebook.com/reel/1234567890123456",
  }) ?? "",
  /postUrl=/,
  "Facebook post URL alone uses proxy for oEmbed fallback"
);

assert.equal(
  shouldProxyPublicationMediaUrl("https://img.youtube.com/vi/dQw4w9wgGcQ/hqdefault.jpg"),
  true
);

assert.equal(
  shouldProxyPublicationMediaUrl("https://scontent.xx.fbcdn.net/v/t15.5256-10/fb.jpg"),
  true
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

assert.equal(
  isVideoPublicationUrl("https://www.instagram.com/reel/ABC123/"),
  true,
  "Instagram reel URLs are video"
);
assert.equal(
  isVideoPublicationUrl("https://www.instagram.com/p/ABC123/"),
  false,
  "Instagram post URLs are not video"
);
assert.equal(
  isVideoPublicationUrl("https://vm.tiktok.com/ZMabcdef/"),
  true,
  "TikTok vm short links are video"
);
assert.equal(
  isVideoPublicationUrl("https://www.tiktok.com/t/ZTRabcdef/"),
  true,
  "TikTok /t/ share links are video"
);
assert.equal(
  isVideoPublicationUrl("https://www.youtube.com/shorts/abc123"),
  true,
  "YouTube shorts are video"
);
assert.equal(
  isVideoPublicationUrl("https://www.facebook.com/reels/123456789"),
  true,
  "Facebook reels plural path is video"
);
assert.equal(
  isCreatorRecentPublicationVideo({
    webVideoUrl: "https://www.tiktok.com/@creator/video/123",
  }),
  true,
  "Raw TikTok rows with webVideoUrl are video"
);
assert.equal(
  isCreatorRecentPublicationVideo({
    url: "https://www.instagram.com/p/ABC123/",
    product_type: "clips",
  }),
  true,
  "Instagram clips product_type is video"
);
assert.equal(
  isCreatorRecentPublicationVideo({
    url: "https://www.instagram.com/p/ABC123/",
    videoViewCount: 12_000,
  }),
  true,
  "Instagram /p/ with view count is video (reel permalink)"
);
assert.equal(
  isCreatorRecentPublicationVideo({
    url: "https://www.instagram.com/p/PHOTO/",
    likes: 100,
    comments: 5,
  }),
  false,
  "Instagram photo without views is not video"
);

const reelNormalized = normalizeCreatorRecentPublications([
  {
    url: "https://www.instagram.com/p/REELSHORT/",
    displayUrl: IG_CDN,
    product_type: "clips",
    videoViewCount: 5000,
    likesCount: 100,
  },
]);
assert.equal(reelNormalized[0]?.isVideo, true, "normalize preserves isVideo for reels");

const tiktokShortNormalized = normalizeCreatorRecentPublications([
  {
    url: "https://vm.tiktok.com/ZMabcdef/",
    videoMeta: { coverUrl: TT_COVER },
    playCount: 9000,
  },
]);
assert.equal(tiktokShortNormalized[0]?.isVideo, true, "normalize detects vm.tiktok short links");

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    displayUrl: "https://scontent.cdninstagram.com/v/t51.82787-15/full.jpg",
    thumbnail: "https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/thumb.jpg",
  }),
  "https://scontent.cdninstagram.com/v/t51.82787-15/full.jpg",
  "prefer displayUrl over stored thumbnail"
);

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    thumbnailSrc: "https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/tiny.jpg",
    originalCoverUrl: "https://scontent.cdninstagram.com/v/t51.82787-15/cover.jpg",
  }),
  "https://scontent.cdninstagram.com/v/t51.82787-15/cover.jpg",
  "prefer original cover over a tiny thumbnailSrc"
);

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    thumbnail: "https://scontent.cdninstagram.com/v/t51.2885-19/s150x150/avatar.jpg",
    displayUrl: "https://scontent.cdninstagram.com/v/t51.82787-15/post.jpg",
  }),
  "https://scontent.cdninstagram.com/v/t51.82787-15/post.jpg",
  "never use an Instagram profile pic as a publication image when post media exists"
);

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    thumbnail: "https://scontent.cdninstagram.com/v/t51.2885-19/s150x150/avatar.jpg",
  }),
  null,
  "profile-pic-only rows have no publication image"
);

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    screenshot_url: "https://abc.supabase.co/storage/v1/object/sign/campaign-publication-media/screenshot.jpg",
    displayUrl: "https://scontent.cdninstagram.com/v/t51.82787-15/post.jpg",
  }),
  "https://scontent.cdninstagram.com/v/t51.82787-15/post.jpg",
  "prefer actual post media over a stored screenshot"
);

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    screenshot_url:
      "https://abc.supabase.co/storage/v1/object/sign/campaign-publication-media/screenshot.jpg",
    displayUrl: "https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/thumb.jpg",
  }),
  "https://abc.supabase.co/storage/v1/object/sign/campaign-publication-media/screenshot.jpg",
  "prefer stored screenshot over a tiny CDN thumb"
);

assert.equal(
  resolveCreatorRecentPublicationThumbnail({
    thumbnail: "https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/thumb.jpg",
  }),
  "https://scontent.cdninstagram.com/v/t51.2885-15/s1080x1080/thumb.jpg",
  "rewrite unsigned low-res thumbs to a larger CDN size"
);

assert.equal(
  isLikelyLowResolutionSocialThumb(
    "https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/thumb.jpg?stp=s150x150"
  ),
  true
);
assert.equal(
  isLikelyLowResolutionSocialThumb(
    "https://scontent.cdninstagram.com/v/t51.2885-15/123_150x150.jpg"
  ),
  true,
  "filename _150x150 without s-prefix is a thumb"
);
assert.equal(
  isLikelyLowResolutionSocialThumb(
    "https://scontent.cdninstagram.com/v/t51.82787-15/full.jpg?stp=dst-jpg_e35_s150x150&oh=abc"
  ),
  true,
  "stp size token marks a thumb"
);
assert.equal(
  isLikelyLowResolutionSocialThumb("https://scontent.cdninstagram.com/v/t51.82787-15/full.jpg"),
  false
);
assert.match(
  preferHigherResolutionSocialImageUrl(
    "https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/thumb.jpg?stp=s150x150"
  ),
  /s1080x1080/
);
assert.deepEqual(
  higherResolutionSocialImageUrlCandidates(
    "https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/thumb.jpg"
  ),
  [
    "https://scontent.cdninstagram.com/v/t51.2885-15/s1080x1080/thumb.jpg",
    "https://scontent.cdninstagram.com/v/t51.2885-15/s640x640/thumb.jpg",
    "https://scontent.cdninstagram.com/v/t51.2885-15/s320x320/thumb.jpg",
  ]
);
assert.equal(
  socialCdnUrlLooksSigned(
    "https://scontent.cdninstagram.com/v/t51.jpg?oh=abc&oe=ABCDEF12"
  ),
  true
);
assert.equal(
  socialCdnUrlLooksSigned("https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/thumb.jpg"),
  false
);

console.log("recent-publication-thumb tests passed");
