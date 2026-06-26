import assert from "node:assert/strict";

import {
  AVATAR_SYNC_STALE_MS,
  isAvatarSyncStale,
  isBrokenAvatarUrl,
  isPlaceholderAvatarUrl,
  shouldSyncPlatformAvatar,
} from "@/lib/performance/avatar-sync-policy";

assert.equal(isPlaceholderAvatarUrl("https://ui-avatars.com/api/?name=AB"), true);
assert.equal(
  isPlaceholderAvatarUrl("https://cdn.example.com/default-avatar.png"),
  true
);
assert.equal(
  isPlaceholderAvatarUrl("https://p16-sign-va.tiktokcdn.com/avatar.jpg"),
  false
);

assert.equal(isBrokenAvatarUrl(""), true);
assert.equal(isBrokenAvatarUrl("not-a-url"), true);
assert.equal(
  isBrokenAvatarUrl("https://p16-sign-va.tiktokcdn.com/avatar.jpg"),
  false
);

const now = Date.parse("2026-06-24T12:00:00.000Z");
const fresh = new Date(now - AVATAR_SYNC_STALE_MS + 60_000).toISOString();
const stale = new Date(now - AVATAR_SYNC_STALE_MS - 60_000).toISOString();

assert.equal(isAvatarSyncStale(fresh, now), false);
assert.equal(isAvatarSyncStale(stale, now), true);
assert.equal(isAvatarSyncStale(null, now), true);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "manual",
      avatar_last_synced_at: stale,
    },
    now
  ),
  false,
  "manual never auto-syncs"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: null,
      avatar_source: "manual",
      avatar_last_synced_at: null,
    },
    now
  ),
  true,
  "manual with empty url may receive first automated fill"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: null,
      avatar_source: "apify",
      avatar_last_synced_at: null,
    },
    now
  ),
  true
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "apify",
      avatar_last_synced_at: stale,
    },
    now
  ),
  true,
  "stale apify may refresh"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "apify",
      avatar_last_synced_at: fresh,
    },
    now
  ),
  false,
  "fresh apify kept"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://ui-avatars.com/api/?name=X",
      avatar_source: "discovery",
      avatar_last_synced_at: fresh,
    },
    now
  ),
  true,
  "placeholder triggers refresh even when fresh"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://ui-avatars.com/api/?name=X",
      avatar_source: "manual",
      avatar_last_synced_at: stale,
    },
    now
  ),
  true,
  "manual placeholder may refresh"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "manual",
      avatar_last_synced_at: stale,
    },
    now,
    { allowManualCrossPlatformRefresh: true }
  ),
  true,
  "manual with cross-platform blocked URL may refresh"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png",
      avatar_source: "manual",
      avatar_last_synced_at: fresh,
    },
    now
  ),
  true,
  "Instagram static default placeholder may refresh"
);

assert.equal(
  isPlaceholderAvatarUrl("https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png"),
  true
);

console.log("avatar-sync-policy tests passed");
