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

assert.equal(pickApifyAuthorAvatarUrl("tiktok", { playCount: 100 }), null);

console.log("apify-author-avatar tests passed");
