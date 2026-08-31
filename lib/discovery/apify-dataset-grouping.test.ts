import assert from "node:assert/strict";
import test from "node:test";

import {
  groupApifyRowsIntoCreators,
  isApifyProfileDetailRow,
} from "./apify-dataset-grouping";

test("snapchat subscriberCount rows are profile details, not posts", () => {
  assert.equal(
    isApifyProfileDetailRow({
      username: "suhaibshashaa",
      subscriberCount: 120_000,
      profileType: "public",
      displayName: "Suhaib",
    }),
    true
  );
});

test("groups snapchat scraper rows into profile bundles with followers field path", () => {
  const bundles = groupApifyRowsIntoCreators(
    [
      {
        username: "suhaibshashaa",
        displayName: "Suhaib Shashaa",
        subscriberCount: 250_000,
        profileType: "public",
        bio: "Creator",
      },
    ],
    "snapchat"
  );

  assert.equal(bundles.length, 1);
  assert.equal(bundles[0]?.username, "suhaibshashaa");
  assert.equal(bundles[0]?.profileRows.length, 1);
  assert.equal(bundles[0]?.postRows.length, 0);
  assert.equal(bundles[0]?.profileRows[0]?.subscriberCount, 250_000);
});

test("groups YouTube video rows by channel URL handle", () => {
  const bundles = groupApifyRowsIntoCreators(
    [
      {
        title: "Video one",
        url: "https://www.youtube.com/watch?v=aaa",
        viewCount: 10_000,
        channelName: "Lofi Girl",
        channelUrl: "https://www.youtube.com/@LofiGirl",
        numberOfSubscribers: 13_100_000,
      },
      {
        title: "Video two",
        url: "https://www.youtube.com/watch?v=bbb",
        viewCount: 20_000,
        channelUrl: "https://www.youtube.com/@LofiGirl",
        numberOfSubscribers: 13_100_000,
      },
    ],
    "youtube"
  );

  assert.equal(bundles.length, 1);
  assert.equal(bundles[0]?.username, "lofigirl");
  assert.equal(bundles[0]?.profileRows.length, 0, "video rows are publications, not page details");
  assert.equal(bundles[0]?.postRows.length, 2);
});

test("groups Facebook page details and posts onto the same handle", () => {
  const bundles = groupApifyRowsIntoCreators(
    [
      {
        title: "NASA Earth",
        pageName: "nasaearth",
        followers: 10_921_894,
        facebookUrl: "https://www.facebook.com/nasaearth",
      },
      {
        pageName: "nasaearth",
        url: "https://www.facebook.com/nasaearth/posts/123",
        likes: 40,
        comments: 2,
        viewCount: 9_000,
      },
    ],
    "facebook"
  );

  assert.equal(bundles.length, 1);
  assert.equal(bundles[0]?.username, "nasaearth");
  assert.equal(bundles[0]?.profileRows.length, 1);
  assert.equal(bundles[0]?.postRows.length, 1);
});
