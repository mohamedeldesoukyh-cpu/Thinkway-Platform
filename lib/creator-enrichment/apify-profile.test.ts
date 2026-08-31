import assert from "node:assert/strict";

import {
  normalizeApifyProfileData,
  pickApifyAudienceCountry,
  pickApifyInterestCategories,
  pickApifyProfilePictureFromRows,
} from "@/lib/creator-enrichment/apify-profile";
import { pickApifyAuthorFollowerCount } from "@/lib/performance/apify-author-followers";

const TT_AVATAR =
  "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/abc~tplv-tiktokx-cropcenter:720:720.jpeg?x-expires=9999999999&x-signature=abc";
const TT_ORIGINAL =
  "https://p77-sign-va.tiktokcdn.com/tos-maliva-avt-0068/abc~tplv-tiktokx-cropcenter:720:720.jpeg?x-expires=9999999999&x-signature=def";

/** clockworks/tiktok-scraper post row shape (with.fatimma-style). */
const WITH_FATIMMA_POST_ROW = {
  id: "7123456789012345678",
  text: "Morning routine #beauty #skincare #grwm",
  diggCount: 420,
  playCount: 12_400,
  commentCount: 18,
  hashtags: [{ name: "beauty" }, { name: "skincare" }, { name: "grwm" }],
  authorMeta: {
    id: "7123456789012345678",
    name: "with.fatimma",
    nickName: "Fatimma",
    signature: "Beauty & lifestyle",
    fans: 11_200,
    following: 120,
    video: 48,
    verified: false,
    region: "AE",
    avatar: TT_AVATAR,
    originalAvatarUrl: TT_ORIGINAL,
    commerceUserInfo: { commerceUser: false },
  },
};

assert.equal(
  pickApifyProfilePictureFromRows("tiktok", [
    { playCount: 100, commentCount: 2 },
    WITH_FATIMMA_POST_ROW,
  ]),
  TT_ORIGINAL,
  "scan all rows for authorMeta avatar when first row lacks authorMeta"
);

assert.equal(
  pickApifyProfilePictureFromRows("tiktok", [WITH_FATIMMA_POST_ROW]),
  TT_ORIGINAL,
  "prefer originalAvatarUrl from authorMeta"
);

assert.equal(
  pickApifyAudienceCountry(
    "tiktok",
    WITH_FATIMMA_POST_ROW,
    WITH_FATIMMA_POST_ROW.authorMeta as Record<string, unknown>,
    [WITH_FATIMMA_POST_ROW]
  ),
  "AE",
  "map authorMeta.region to audience country"
);

assert.deepEqual(
  pickApifyInterestCategories(
    "tiktok",
    WITH_FATIMMA_POST_ROW,
    WITH_FATIMMA_POST_ROW.authorMeta as Record<string, unknown>,
    ["#beauty", "#skincare", "#grwm"]
  ),
  ["beauty", "skincare"],
  "derive TikTok interest tags from post hashtags when no business category"
);

assert.deepEqual(
  pickApifyInterestCategories(
    "instagram",
    { businessCategoryName: "Beauty, cosmetic & personal care" },
    {},
    ["#grwm", "#fitness"]
  ),
  [],
  "Instagram Facebook page categories are not creator niches"
);

assert.equal(
  pickApifyProfilePictureFromRows("tiktok", [
    {
      uniqueId: "with.fatimma",
      avatarLarger: TT_AVATAR,
      fans: 11_200,
    },
  ]),
  TT_AVATAR,
  "top-level profile scraper avatarLarger"
);

const FB_AVATAR =
  "https://scontent.xx.fbcdn.net/v/t39.30808-1/435065639_833099202199246_n.jpg";

assert.equal(
  pickApifyProfilePictureFromRows("facebook", [
    {
      title: "NASA Earth",
      followers: 10_921_894,
      profilePictureUrl: FB_AVATAR,
    },
  ]),
  FB_AVATAR,
  "facebook pages scraper profilePictureUrl"
);

assert.equal(
  pickApifyAuthorFollowerCount("facebook", { followers: 514_363 }),
  514_363,
  "facebook pages scraper followers field"
);

const facebookProfile = normalizeApifyProfileData({
  platformKey: "facebook",
  username: "nasaearth",
  profileUrl: "https://www.facebook.com/nasaearth",
  profileRows: [
    {
      title: "NASA Earth",
      pageName: "nasaearth",
      followers: 10_921_894,
      intro: "Explore our home planet.",
      profilePictureUrl: FB_AVATAR,
    },
  ],
  postRows: [],
  apifyRunId: "run-fb-1",
});
assert.ok(facebookProfile);
assert.equal(facebookProfile?.displayName, "NASA Earth");
assert.equal(facebookProfile?.followers, 10_921_894);
assert.equal(facebookProfile?.bio, "Explore our home planet.");
assert.equal(facebookProfile?.profilePictureUrl, FB_AVATAR);
assert.equal(facebookProfile?.avgViews, null, "page-only payload has no publications");

const youtubeProfile = normalizeApifyProfileData({
  platformKey: "youtube",
  username: "lofigirl",
  profileUrl: "https://www.youtube.com/@LofiGirl",
  profileRows: [],
  postRows: [
    {
      title: "Raimu - The Spirit Within",
      url: "https://www.youtube.com/watch?v=HV6OlMPn5sI",
      viewCount: 410_458,
      likes: 12_400,
      commentsCount: 88,
      channelName: "Lofi Girl",
      channelUrl: "https://www.youtube.com/@LofiGirl",
      numberOfSubscribers: 13_100_000,
    },
    {
      title: "Short loop",
      url: "https://www.youtube.com/shorts/abc123xyz",
      viewCount: 89_542,
      likes: 3_100,
      commentsCount: 40,
      channelName: "Lofi Girl",
      channelUrl: "https://www.youtube.com/@LofiGirl",
      numberOfSubscribers: 13_100_000,
    },
  ],
  apifyRunId: "run-yt-1",
});
assert.ok(youtubeProfile);
assert.equal(youtubeProfile?.displayName, "Lofi Girl");
assert.equal(youtubeProfile?.followers, 13_100_000);
assert.equal(youtubeProfile?.avgViews, Math.round((410_458 + 89_542) / 2));
assert.ok((youtubeProfile?.engagementRate ?? 0) > 0);

const facebookWithPosts = normalizeApifyProfileData({
  platformKey: "facebook",
  username: "nasaearth",
  profileUrl: "https://www.facebook.com/nasaearth",
  profileRows: [
    {
      title: "NASA Earth",
      pageName: "nasaearth",
      followers: 10_921_894,
      likes: 9_000_000,
      intro: "Explore our home planet.",
    },
  ],
  postRows: [
    {
      pageName: "nasaearth",
      url: "https://www.facebook.com/nasaearth/videos/123",
      text: "Earth from orbit",
      likes: 420,
      comments: 18,
      viewCount: 58_900,
    },
    {
      pageName: "nasaearth",
      postUrl: "https://www.facebook.com/reel/1849794332663999",
      likesCount: 310,
      commentsCount: 12,
      videoViewCount: 41_200,
    },
  ],
  apifyRunId: "run-fb-2",
});
assert.ok(facebookWithPosts);
assert.equal(facebookWithPosts?.followers, 10_921_894);
assert.equal(facebookWithPosts?.postsCount, null, "page likes must not become posts_count");
assert.equal(facebookWithPosts?.avgViews, Math.round((58_900 + 41_200) / 2));
assert.ok((facebookWithPosts?.engagementRate ?? 0) > 0);

console.log("apify-profile tests passed");
