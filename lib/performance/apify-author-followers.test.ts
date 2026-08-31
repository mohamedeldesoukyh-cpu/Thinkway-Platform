import assert from "node:assert/strict";

import { pickApifyAuthorFollowerCount } from "@/lib/performance/apify-author-followers";

assert.equal(
  pickApifyAuthorFollowerCount("tiktok", {
    authorMeta: { fans: 1_700_000 },
  }),
  1_700_000
);

assert.equal(
  pickApifyAuthorFollowerCount("tiktok", {
    authorMeta: { followerCount: 279200 },
  }),
  279200
);

assert.equal(
  pickApifyAuthorFollowerCount("instagram", {
    owner: { followersCount: 1_700_000 },
  }),
  1_700_000
);

assert.equal(
  pickApifyAuthorFollowerCount("instagram", {
    videoPlayCount: 707796,
    ownerUsername: "amiryoussef.official",
  }),
  null,
  "instagram post payload without owner stats"
);

assert.equal(
  pickApifyAuthorFollowerCount("youtube", { numberOfSubscribers: 13_100_000 }),
  13_100_000,
  "streamers/youtube-scraper numberOfSubscribers"
);

assert.equal(
  pickApifyAuthorFollowerCount("facebook", { followers: 514_363, likes: 1_148_094 }),
  514_363,
  "facebook pages scraper followers field"
);

console.log("apify-author-followers tests passed");
