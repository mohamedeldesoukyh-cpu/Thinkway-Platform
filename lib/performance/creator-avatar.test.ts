import assert from "node:assert/strict";

import {
  detectAvatarCdn,
  isAvatarUrlAllowedForPlatform,
  isInstagramHostedAvatarUrl,
  isTikTokHostedAvatarUrl,
  isYouTubeHostedAvatarUrl,
  resolveBrowseCreatorProfileImageUrl,
  resolveCreatorAvatarDisplay,
  resolvePublicationCreatorAvatar,
  resolvePublicationEffectivePlatform,
  resolvePublicationRowCreatorAvatar,
  stabilizeTikTokAvatarUrl,
  prepareCreatorAvatarUrlForDisplay,
  creatorAvatarDisplayUrls,
} from "@/lib/performance/creator-avatar";

const IG_CDN = "https://scontent-lhr8-1.cdninstagram.com/v/t51.2885-19/abc.jpg";
const TT_CDN = "https://p16-sign-va.tiktokcdn.com/avatar.jpg";
const TT_IBYTEIMG = "https://p16-sign-va.ibyteimg.com/tos-maliva-avt-0068/avatar.jpeg";
const YT_CDN = "https://yt3.ggpht.com/ytc/default.jpg";

assert.equal(isInstagramHostedAvatarUrl(IG_CDN), true);
assert.equal(isTikTokHostedAvatarUrl(TT_CDN), true);
assert.equal(isTikTokHostedAvatarUrl(TT_IBYTEIMG), true);
assert.equal(
  isTikTokHostedAvatarUrl("https://p16-sign-va.tiktokcdn-eu.com/avatar.jpg"),
  true
);
assert.equal(
  isTikTokHostedAvatarUrl("https://sf16-website-login.neutral.ttwstatic.com/obj/avatar.jpg"),
  true
);
assert.equal(isYouTubeHostedAvatarUrl(YT_CDN), true);
assert.equal(
  isInstagramHostedAvatarUrl("https://p16-sign-va.tiktokcdn.com/avatar.jpg"),
  false
);

assert.equal(detectAvatarCdn(IG_CDN), "instagram");
assert.equal(detectAvatarCdn(TT_CDN), "tiktok");
assert.equal(detectAvatarCdn(TT_IBYTEIMG), "tiktok");
assert.equal(detectAvatarCdn(YT_CDN), "youtube");

// Signed TikTok CDN URLs are stabilized for display (strip x-expires / -sign host).
assert.equal(
  stabilizeTikTokAvatarUrl(
    "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/abc.webp?x-expires=1661893200&x-signature=abc"
  ),
  "https://p16-va.tiktokcdn.com/tos-maliva-avt-0068/abc.webp"
);

// Apify author avatar on ibyteimg must resolve for TikTok rows (not only tiktokcdn.com).
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    platform_profile_picture_url: null,
    influencer_avatar_url: null,
    apify_author_avatar_url: TT_IBYTEIMG,
  }),
  "https://p16-va.ibyteimg.com/tos-maliva-avt-0068/avatar.jpeg",
  "ibyteimg Apify avatar on TikTok row"
);

// TikTok alias tt resolves the same as tiktok for avatar fallbacks.
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tt",
    apify_author_avatar_url: TT_CDN,
  }),
  "https://p16-va.tiktokcdn.com/avatar.jpg",
  "tt alias + stabilized tiktokcdn URL"
);

// TikTok row must not use Instagram CDN on platform account picture.
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    creator_profile_image_url: null,
    influencer_avatar_url: null,
    platform_profile_picture_url: IG_CDN,
  }),
  null,
  "IG CDN on TikTok platform account must be rejected"
);

// TikTok CDN on Instagram row rejected.
assert.equal(isAvatarUrlAllowedForPlatform("instagram", TT_CDN), false);
assert.equal(isAvatarUrlAllowedForPlatform("tiktok", TT_CDN), true);
assert.equal(isAvatarUrlAllowedForPlatform("youtube", YT_CDN), true);
assert.equal(isAvatarUrlAllowedForPlatform("tiktok", YT_CDN), false);

assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    platform_profile_picture_url: TT_CDN,
  }),
  "https://p16-va.tiktokcdn.com/avatar.jpg"
);

// Priority: platform account → influencer avatar → apify → discovery (IG only).
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "instagram",
    platform_profile_picture_url: "https://cdn.example.com/platform.jpg",
    influencer_avatar_url: "https://cdn.example.com/influencer.jpg",
    apify_author_avatar_url: "https://cdn.example.com/apify.jpg",
    creator_profile_image_url: "https://cdn.example.com/discovery.jpg",
  }),
  "https://cdn.example.com/platform.jpg"
);

assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "instagram",
    platform_profile_picture_url: null,
    influencer_avatar_url: "https://cdn.example.com/influencer.jpg",
    apify_author_avatar_url: "https://cdn.example.com/apify.jpg",
    creator_profile_image_url: "https://cdn.example.com/discovery.jpg",
  }),
  "https://cdn.example.com/influencer.jpg"
);

assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "instagram",
    platform_profile_picture_url: null,
    influencer_avatar_url: null,
    apify_author_avatar_url: "https://cdn.example.com/apify.jpg",
    creator_profile_image_url: "https://cdn.example.com/discovery.jpg",
  }),
  "https://cdn.example.com/apify.jpg"
);

// Infer platform from deliverable type when platform field is empty.
assert.equal(
  resolvePublicationEffectivePlatform({
    platform: "",
    publication_type: "tiktok_video",
    content_url: null,
  }),
  "tiktok"
);

assert.equal(
  resolvePublicationEffectivePlatform({
    platform: "unknown",
    publication_type: "other",
    content_url: "https://www.tiktok.com/@creator/video/123",
  }),
  "tiktok"
);

// Row resolver uses publication_type + content_url for platform inference.
assert.equal(
  resolvePublicationRowCreatorAvatar({
    platform: "",
    publication_type: "tiktok_video",
    content_url: null,
    creator_profile_image_url: IG_CDN,
    influencer_avatar_url: null,
    social_profile_picture_url: null,
  }),
  null
);

assert.equal(
  resolvePublicationRowCreatorAvatar({
    platform: "tiktok",
    influencer_avatar_url: TT_CDN,
    social_profile_picture_url: null,
  }),
  "https://p16-va.tiktokcdn.com/avatar.jpg",
  "platform-safe influencer avatar on TikTok row"
);

assert.equal(
  isAvatarUrlAllowedForPlatform("tiktok", IG_CDN),
  false
);
assert.equal(
  isAvatarUrlAllowedForPlatform("instagram", IG_CDN),
  true
);

// Display resolver fallbacks.
assert.equal(
  resolveCreatorAvatarDisplay({
    platform: "tiktok",
    influencer_name: "Jane Doe",
    social_profile_picture_url: null,
    influencer_avatar_url: null,
  }).kind,
  "initials"
);

const ttDisplay = resolveCreatorAvatarDisplay({
  platform: "tiktok",
  influencer_name: null,
  social_profile_picture_url: TT_CDN,
});
assert.equal(ttDisplay.kind, "image");
if (ttDisplay.kind === "image") {
  assert.equal(ttDisplay.url, "https://p16-va.tiktokcdn.com/avatar.jpg");
  assert.equal(ttDisplay.fallbackUrl, TT_CDN);
}

assert.deepEqual(creatorAvatarDisplayUrls("tiktok", TT_CDN), {
  primary: "https://p16-va.tiktokcdn.com/avatar.jpg",
  fallback: TT_CDN,
});
assert.equal(prepareCreatorAvatarUrlForDisplay("tt", TT_CDN), "https://p16-va.tiktokcdn.com/avatar.jpg");

assert.equal(
  resolveCreatorAvatarDisplay({
    platform: "tiktok",
    influencer_name: null,
    social_profile_picture_url: null,
  }).kind,
  "placeholder"
);

const IG_PLACEHOLDER = "https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png";
const IG_REAL = "https://scontent.cdninstagram.com/v/profile.jpg";

assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "instagram",
    platform_profile_picture_url: IG_PLACEHOLDER,
    influencer_avatar_url: IG_REAL,
  }),
  IG_REAL,
  "skip Instagram static placeholder in favor of real influencer avatar"
);

assert.equal(
  resolveCreatorAvatarDisplay({
    platform: "instagram",
    influencer_name: "Jane Doe",
    social_profile_picture_url: IG_PLACEHOLDER,
    influencer_avatar_url: null,
  }).kind,
  "initials",
  "placeholder platform picture falls through to initials"
);

assert.equal(
  resolveBrowseCreatorProfileImageUrl({
    platform: "instagram",
    platformPictureUrl: null,
    platformAvatarUrl: "https://cdn.example.com/platform-meta.jpg",
    discoveryProfileImageUrl: IG_CDN,
    influencerAvatarUrl: "https://cdn.example.com/influencer.jpg",
  }),
  "https://cdn.example.com/platform-meta.jpg",
  "platform metadata avatar before influencer/discovery"
);

assert.equal(
  resolveBrowseCreatorProfileImageUrl({
    platform: "instagram",
    platformPictureUrl: null,
    platformAvatarUrl: null,
    discoveryProfileImageUrl: IG_CDN,
    influencerAvatarUrl: "https://cdn.example.com/influencer.jpg",
  }),
  "https://cdn.example.com/influencer.jpg",
  "influencer avatar before discovery profile"
);

assert.equal(
  resolveBrowseCreatorProfileImageUrl({
    platform: "instagram",
    platformPictureUrl: null,
    discoveryProfileImageUrl: IG_CDN,
  }),
  IG_CDN,
  "discovery profile image fallback"
);

assert.equal(
  resolveBrowseCreatorProfileImageUrl({
    platform: "instagram",
    platformPictureUrl: IG_PLACEHOLDER,
    discoveryProfileImageUrl: IG_CDN,
  }),
  IG_CDN,
  "reject placeholder platform photo, use discovery image"
);

console.log("creator-avatar tests passed");
