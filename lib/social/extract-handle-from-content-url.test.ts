import assert from "node:assert/strict";

import { extractHandleFromContentUrl } from "@/lib/social/extract-handle-from-content-url";
import { matchAssignmentLineFromContentUrl } from "@/lib/campaigns/match-assignment-from-content-url";

assert.deepEqual(
  extractHandleFromContentUrl(
    "https://www.tiktok.com/@ramysoli/video/7668365507552103700"
  ),
  { platform: "tiktok", handle: "ramysoli" }
);

assert.equal(
  extractHandleFromContentUrl("https://www.instagram.com/reel/AbCdEf123/"),
  null,
  "bare IG reel URLs have no creator handle"
);

assert.deepEqual(
  extractHandleFromContentUrl("https://www.instagram.com/the_mommy_eats/reel/AbCdEf/"),
  { platform: "instagram", handle: "the_mommy_eats" }
);

assert.deepEqual(
  extractHandleFromContentUrl("https://www.facebook.com/nasaearth/videos/123"),
  { platform: "facebook", handle: "nasaearth" }
);

assert.equal(
  extractHandleFromContentUrl("https://www.facebook.com/search/top?q=x"),
  null,
  "Facebook /search path is not a creator handle"
);

const lines = [
  {
    id: "line-a",
    creator_platform_accounts: [{ platform: "tiktok", handle: "ramysoli" }],
  },
  {
    id: "line-b",
    creator_platform_accounts: [{ platform: "instagram", handle: "other" }],
  },
];

assert.equal(
  matchAssignmentLineFromContentUrl(
    "https://www.tiktok.com/@ramysoli/video/1",
    lines
  )?.id,
  "line-a"
);

assert.equal(
  matchAssignmentLineFromContentUrl("https://www.instagram.com/reel/xyz/", lines)?.id,
  "line-b",
  "bare IG reel auto-assigns the only Instagram assignee"
);

assert.equal(
  matchAssignmentLineFromContentUrl(
    "https://www.instagram.com/reel/xyz/",
    [
      ...lines,
      {
        id: "line-c",
        creator_platform_accounts: [{ platform: "instagram", handle: "second" }],
      },
    ]
  ),
  null,
  "bare IG reel stays unmatched when multiple IG assignees exist"
);

assert.equal(
  matchAssignmentLineFromContentUrl("https://www.tiktok.com/@ghost/video/1", [
    {
      id: "line-name",
      influencer_name: "Ghost Creator (@ghost)",
      platform: "tiktok",
      creator_platform_accounts: [],
    },
  ])?.id,
  "line-name",
  "matches @handle embedded in influencer_name"
);

console.log("extract-handle + assignment match — all tests passed");
