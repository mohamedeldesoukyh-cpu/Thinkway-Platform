import assert from "node:assert/strict";

import { pickApifyAuthorAvatarUrl } from "@/lib/performance/apify-author-avatar";

const IG_CDN = "https://scontent.cdninstagram.com/v/profile.jpg";
const TT_CDN = "https://p16-sign-va.tiktokcdn.com/avatar.jpg";
const YT_CDN = "https://yt3.ggpht.com/avatar.jpg";

assert.equal(
  pickApifyAuthorAvatarUrl("tiktok", {
    authorMeta: { avatar: TT_CDN, originalAvatarUrl: "https://p77.tiktokcdn.com/orig.jpg" },
  }),
  "https://p77.tiktokcdn.com/orig.jpg"
);

assert.equal(
  pickApifyAuthorAvatarUrl("tiktok", {
    authorMeta: { avatar: TT_CDN },
  }),
  TT_CDN
);

assert.equal(
  pickApifyAuthorAvatarUrl("instagram", {
    ownerProfilePicUrl: IG_CDN,
    displayUrl: "https://example.com/post.jpg",
  }),
  IG_CDN
);

assert.equal(
  pickApifyAuthorAvatarUrl("instagram", {
    owner: { profilePicUrl: IG_CDN },
  }),
  IG_CDN
);

assert.equal(
  pickApifyAuthorAvatarUrl("tiktok", {
    authorMeta: { avatar: IG_CDN },
  }),
  null,
  "reject Instagram CDN on TikTok row"
);

assert.equal(
  pickApifyAuthorAvatarUrl("instagram", {
    authorMeta: { avatar: TT_CDN },
  }),
  null,
  "reject TikTok CDN on Instagram row"
);

assert.equal(
  pickApifyAuthorAvatarUrl("youtube", {
    channel: { avatarUrl: YT_CDN },
  }),
  YT_CDN
);

assert.equal(
  pickApifyAuthorAvatarUrl("youtube", {
    channel: { avatarUrl: IG_CDN },
  }),
  null,
  "reject Instagram CDN on YouTube row"
);

assert.equal(
  pickApifyAuthorAvatarUrl("tt", {
    authorMeta: { avatar: TT_CDN },
  }),
  TT_CDN,
  "tt platform alias must use TikTok avatar candidates"
);

assert.equal(
  pickApifyAuthorAvatarUrl("tiktok", {
    authorMeta: { avatarLarger: TT_CDN },
  }),
  TT_CDN,
  "avatarLarger from TikTok authorMeta"
);

assert.equal(pickApifyAuthorAvatarUrl("tiktok", { playCount: 100 }), null);

assert.equal(
  pickApifyAuthorAvatarUrl("tiktok", {
    authorMeta: { profilePictureUrl: TT_CDN },
  }),
  TT_CDN,
  "profilePictureUrl from TikTok authorMeta"
);

assert.equal(
  pickApifyAuthorAvatarUrl("tiktok", {
    authorAvatarThumbUrl: TT_CDN,
  }),
  TT_CDN,
  "authorAvatarThumbUrl root field"
);

assert.equal(
  pickApifyAuthorAvatarUrl("tiktok", {
    avatarLarger: TT_CDN,
    avatarMedium: "https://p16-sign-va.tiktokcdn.com/thumb.jpg",
  }),
  TT_CDN,
  "top-level profile scraper avatarLarger"
);

assert.equal(
  pickApifyAuthorAvatarUrl("tiktok", {
    authorMeta: {
      avatar:
        "https://p16-sign-va.tiktokcdn.com/expired.jpg?x-expires=1661893200&x-signature=abc",
    },
  }),
  "https://p16-va.tiktokcdn.com/expired.jpg",
  "prefer stabilized TikTok URL when signed copy is expired"
);

assert.equal(
  pickApifyAuthorAvatarUrl("instagram", {
    ownerProfilePicUrl: "https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png",
    profilePicUrlHD: IG_CDN,
  }),
  IG_CDN,
  "skip Instagram default placeholder, use next candidate"
);

assert.equal(
  pickApifyAuthorAvatarUrl("instagram", {
    username: "zeinaelfakahany",
    profilePicUrl: IG_CDN,
    profilePicUrlHD: `${IG_CDN}?oe=1`,
  }),
  IG_CDN,
  "instagram profile details: skip expired HD, use profilePicUrl"
);

console.log("apify-author-avatar tests passed");
