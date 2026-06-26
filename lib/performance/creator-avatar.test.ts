import assert from "node:assert/strict";

import {
  detectAvatarCdn,
  isAvatarUrlAllowedForPlatform,
  isInstagramHostedAvatarUrl,
  isTikTokHostedAvatarUrl,
  isYouTubeHostedAvatarUrl,
  resolveCreatorAvatarDisplay,
  resolvePublicationCreatorAvatar,
  resolvePublicationEffectivePlatform,
  resolvePublicationRowCreatorAvatar,
} from "@/lib/performance/creator-avatar";

const IG_CDN = "https://scontent-lhr8-1.cdninstagram.com/v/t51.2885-19/abc.jpg";
const TT_CDN = "https://p16-sign-va.tiktokcdn.com/avatar.jpg";
const YT_CDN = "https://yt3.ggpht.com/ytc/default.jpg";

assert.equal(isInstagramHostedAvatarUrl(IG_CDN), true);
assert.equal(isTikTokHostedAvatarUrl(TT_CDN), true);
assert.equal(isYouTubeHostedAvatarUrl(YT_CDN), true);
assert.equal(
  isInstagramHostedAvatarUrl("https://p16-sign-va.tiktokcdn.com/avatar.jpg"),
  false
);

assert.equal(detectAvatarCdn(IG_CDN), "instagram");
assert.equal(detectAvatarCdn(TT_CDN), "tiktok");
assert.equal(detectAvatarCdn(YT_CDN), "youtube");

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
  TT_CDN
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
  TT_CDN,
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

assert.equal(
  resolveCreatorAvatarDisplay({
    platform: "tiktok",
    influencer_name: null,
    social_profile_picture_url: TT_CDN,
  }).kind,
  "image"
);

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

console.log("creator-avatar tests passed");
