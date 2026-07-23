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
