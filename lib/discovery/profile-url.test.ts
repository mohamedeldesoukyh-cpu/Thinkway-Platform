import assert from "node:assert/strict";

import {
  openOnPlatformTooltip,
  pickPrimaryPlatformAccount,
  profileLinkTooltip,
  resolveCreatorProfileUrl,
  resolvePrimaryProfileUrl,
} from "@/lib/discovery/profile-url";
import type { UnifiedCreatorPlatform } from "@/lib/creators/types";

// Derives canonical URL when no stored profile_url exists.
assert.equal(
  resolveCreatorProfileUrl({
    platform: "instagram",
    handle: "@creator_handle",
    profile_url: null,
  }),
  "https://www.instagram.com/creator_handle/"
);

// Prefers stored profile_url over derived URL.
assert.equal(
  resolveCreatorProfileUrl({
    platform: "instagram",
    handle: "ignored",
    profile_url: "https://www.instagram.com/stored/",
  }),
  "https://www.instagram.com/stored/"
);

// Invalid / empty handle without stored URL returns null.
assert.equal(
  resolveCreatorProfileUrl({
    platform: "instagram",
    handle: "   ",
    profile_url: null,
  }),
  null
);

assert.equal(resolveCreatorProfileUrl(null), null);

// Unsupported platform falls back to generic domain pattern.
assert.equal(
  resolveCreatorProfileUrl({
    platform: "threads",
    handle: "CreatorName",
    profile_url: null,
  }),
  "https://threads.com/creatorname"
);

// TikTok canonical URL keeps @ prefix in path.
assert.equal(
  resolveCreatorProfileUrl({
    platform: "tiktok",
    handle: "tiktokuser",
    profile_url: null,
  }),
  "https://www.tiktok.com/@tiktokuser"
);

const platforms: UnifiedCreatorPlatform[] = [
  {
    id: "1",
    platform: "youtube",
    handle: "first",
    profile_url: null,
    follower_count: null,
    engagement_rate: null,
    audience_country: null,
  },
  {
    id: "2",
    platform: "instagram",
    handle: "primary",
    profile_url: "https://www.instagram.com/primary/",
    follower_count: null,
    engagement_rate: null,
    audience_country: null,
  },
];

assert.equal(
  resolvePrimaryProfileUrl(platforms),
  "https://www.youtube.com/@first"
);

assert.equal(
  pickPrimaryPlatformAccount([
    { platform: "tiktok", handle: "a", is_primary: false },
    { platform: "instagram", handle: "b", is_primary: true },
  ])?.handle,
  "b"
);

assert.equal(openOnPlatformTooltip("instagram"), "Open on Instagram");
assert.equal(openOnPlatformTooltip("twitter"), "Open on X (Twitter)");
assert.equal(
  profileLinkTooltip("Jane Doe", "tiktok"),
  "Open Jane Doe on TikTok"
);

console.log("profile-url.test.ts: all assertions passed");
