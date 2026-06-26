import assert from "node:assert/strict";

import {
  resolveCreatorAvatarUrl,
  resolvePublicationCreatorAvatar,
} from "@/lib/performance/creator-avatar";
import { normalizePublicationPlatform } from "@/lib/performance/metrics-collector/detect-platform";
import {
  mergeCollectedMetrics,
  sanitizeMetricValue,
  storedMetricsFromPublication,
} from "@/lib/performance/metrics-collector/merge-metrics";
import { PLATFORM_ICON_STYLES } from "@/lib/performance/platform-icon";
import { resolvePublicationContentPreviewUrl } from "@/lib/performance/publication-preview";

// --- Creator avatar priority (non-platform-aware helper) ---
{
  const url = resolveCreatorAvatarUrl({
    creator_profile_image_url: "https://cdn.example.com/profile.jpg",
    influencer_avatar_url: "https://cdn.example.com/avatar.jpg",
    social_profile_picture_url: "https://cdn.example.com/social.jpg",
  });
  assert.equal(url, "https://cdn.example.com/social.jpg");
}

{
  const url = resolveCreatorAvatarUrl({
    creator_profile_image_url: "https://cdn.example.com/profile.jpg",
    influencer_avatar_url: "https://cdn.example.com/avatar.jpg",
    social_profile_picture_url: null,
  });
  assert.equal(url, "https://cdn.example.com/avatar.jpg");
}

{
  const url = resolveCreatorAvatarUrl({
    creator_profile_image_url: null,
    influencer_avatar_url: null,
    social_profile_picture_url: "https://cdn.example.com/social.jpg",
  });
  assert.equal(url, "https://cdn.example.com/social.jpg");
}

assert.equal(
  resolveCreatorAvatarUrl({
    creator_profile_image_url: null,
    influencer_avatar_url: null,
    social_profile_picture_url: null,
  }),
  null
);

// --- Preview column must not use creator avatar ---
assert.equal(
  resolvePublicationContentPreviewUrl({
    screenshot_url: null,
    thumbnail_url: "https://cdn.example.com/post.jpg",
  }),
  "https://cdn.example.com/post.jpg"
);

// --- Metrics never overwritten by null ---
{
  const existing = storedMetricsFromPublication({
    views: 12000,
    likes: 450,
    comments: 32,
    engagement_views: null,
  });
  const merged = mergeCollectedMetrics(existing, {
    views: null,
    likes: null,
    comments: 108,
  });
  assert.equal(merged.views, 12000);
  assert.equal(merged.likes, 450);
  assert.equal(merged.comments, 108);
}

{
  const merged = mergeCollectedMetrics(
    { views: 5000, likes: 200, comments: 15 },
    { views: null, likes: -1, comments: null, shares: 3 }
  );
  assert.equal(merged.views, 5000);
  assert.equal(merged.likes, 200);
  assert.equal(merged.comments, 15);
  assert.equal(merged.shares, 3);
}

// --- Legacy engagement_* columns hydrate stored metrics ---
{
  const stored = storedMetricsFromPublication({
    views: null,
    likes: null,
    engagement_views: 900,
    engagement_likes: 40,
    engagement_comments: 5,
  });
  assert.equal(stored.views, 900);
  assert.equal(stored.likes, 40);
  assert.equal(stored.comments, 5);
}

// --- Platform icons are distinct per platform ---
assert.equal(PLATFORM_ICON_STYLES.instagram?.imageUrl, "/platform-icons/instagram.png");
assert.equal(PLATFORM_ICON_STYLES.tiktok?.imageUrl, "/platform-icons/tiktok.png");
assert.notEqual(PLATFORM_ICON_STYLES.instagram?.imageUrl, PLATFORM_ICON_STYLES.tiktok?.imageUrl);

// --- TikTok publications must not resolve as Instagram when platform field is set ---
assert.equal(normalizePublicationPlatform("tiktok"), "tiktok");
assert.equal(normalizePublicationPlatform("TT"), null);

// --- Platform-specific avatar: no cross-platform social picture ---
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    creator_profile_image_url: "https://cdn.example.com/ig.jpg",
    influencer_avatar_url: null,
    platform_profile_picture_url: null,
  }),
  null
);

// --- Comments-only metrics display (hidden IG likes) ---
{
  const likes = sanitizeMetricValue(-1);
  const comments = sanitizeMetricValue(108);
  assert.equal(likes, null);
  assert.equal(comments, 108);
}

console.log("campaign-performance regression tests passed");
