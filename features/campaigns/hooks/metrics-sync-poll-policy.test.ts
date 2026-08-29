import assert from "node:assert/strict";

import {
  isSyncInFlight,
  isSyncPending,
  METRICS_SYNC_POLL_INTERVAL_MS,
  publicationsNeedAvatarSyncPoll,
  publicationsNeedMetricsSyncPoll,
  publicationsNeedScreenshotCapturePoll,
  SCREENSHOT_CAPTURE_POLL_INTERVAL_MS,
  SCREENSHOT_CAPTURE_POLL_WINDOW_MS,
  AVATAR_SYNC_POLL_WINDOW_MS,
  shouldCompleteMetricsSyncToast,
  shouldShowMetricsSyncLoadingToast,
  type PublicationSyncPollRow,
} from "@/features/campaigns/hooks/metrics-sync-poll-policy";
import { resolvePublicationCreatorAvatar } from "@/lib/performance/creator-avatar";
import { PLATFORM_ICON_STYLES } from "@/lib/performance/platform-icon";
import { sanitizeMetricValue } from "@/lib/performance/metrics-collector/merge-metrics";
import { formatCompactCount } from "@/lib/campaigns/performance-calculations";

// --- TikTok row must not use Instagram CDN on platform account picture ---
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    creator_profile_image_url: null,
    influencer_avatar_url: null,
    platform_profile_picture_url:
      "https://scontent-lhr8-1.cdninstagram.com/v/t51.2885-19/abc.jpg",
  }),
  null,
  "IG CDN stored on TikTok platform account must not render on TT row"
);

// --- TikTok row must not use Instagram social profile picture ---
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    creator_profile_image_url: null,
    influencer_avatar_url: null,
    platform_profile_picture_url: null,
  }),
  null
);

// TikTok row uses influencer-level avatar (unknown CDN ok), but not discovery profile.
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    creator_profile_image_url: "https://cdn.example.com/ig-discovered.jpg",
    influencer_avatar_url: "https://cdn.example.com/ig-meta.jpg",
    platform_profile_picture_url: null,
  }),
  "https://cdn.example.com/ig-meta.jpg"
);

assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    creator_profile_image_url: "https://cdn.example.com/ig-discovered.jpg",
    influencer_avatar_url: null,
    platform_profile_picture_url: "https://cdn.example.com/tiktok.jpg",
  }),
  "https://cdn.example.com/tiktok.jpg"
);

assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "instagram",
    creator_profile_image_url: "https://cdn.example.com/creator.jpg",
    influencer_avatar_url: "https://cdn.example.com/ig-only.jpg",
    platform_profile_picture_url: "https://cdn.example.com/ig-social.jpg",
  }),
  "https://cdn.example.com/ig-social.jpg"
);

// --- TikTok alias "tt" must not use generic Instagram avatar ---
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tt",
    creator_profile_image_url: "https://cdn.example.com/ig-only.jpg",
    influencer_avatar_url: null,
    platform_profile_picture_url: null,
  }),
  null,
  "tt alias should resolve as TikTok — no IG discovered profile"
);

// Shimaa-style case: only Instagram discovered profile exists — TikTok row gets no avatar URL.
assert.equal(
  resolvePublicationCreatorAvatar({
    platform: "tiktok",
    creator_profile_image_url: "https://cdn.example.com/ig-only.jpg",
    influencer_avatar_url: null,
    platform_profile_picture_url: null,
  }),
  null,
  "TikTok row without platform avatar should fall back to PlatformIcon, not IG photo"
);

assert.notEqual(PLATFORM_ICON_STYLES.tiktok?.imageUrl, PLATFORM_ICON_STYLES.instagram?.imageUrl);

// --- Sync state helpers ---
assert.equal(isSyncInFlight("queued"), true);
assert.equal(isSyncInFlight("collecting"), true);
assert.equal(isSyncInFlight("pending"), false);
assert.equal(isSyncInFlight("completed"), false);
assert.equal(isSyncInFlight(null), false);
assert.equal(isSyncPending("pending"), true);
assert.equal(isSyncPending("queued"), false);

// --- In-flight metrics statuses keep polling active ---
assert.equal(
  publicationsNeedMetricsSyncPoll([
    { metrics_refresh_status: "collecting" },
  ] as PublicationSyncPollRow[]),
  true
);
assert.equal(
  publicationsNeedMetricsSyncPoll([
    { metrics_refresh_status: "queued" },
  ] as PublicationSyncPollRow[]),
  true
);
assert.equal(
  publicationsNeedMetricsSyncPoll([
    { metrics_refresh_status: "pending" },
  ] as PublicationSyncPollRow[]),
  false,
  "pending means never collected — must not poll"
);
assert.equal(
  publicationsNeedMetricsSyncPoll([
    { metrics_refresh_status: "completed" },
  ] as PublicationSyncPollRow[]),
  false
);
assert.equal(
  publicationsNeedMetricsSyncPoll([
    { metrics_refresh_status: "failed" },
  ] as PublicationSyncPollRow[]),
  false,
  "failed metrics sync should stop polling"
);
assert.equal(
  publicationsNeedMetricsSyncPoll([
    { metrics_refresh_status: "completed" },
    { metrics_refresh_status: "collecting" },
  ] as PublicationSyncPollRow[]),
  true
);
assert.equal(METRICS_SYNC_POLL_INTERVAL_MS, 4_000);
assert.equal(SCREENSHOT_CAPTURE_POLL_INTERVAL_MS, 30_000);
assert.equal(SCREENSHOT_CAPTURE_POLL_WINDOW_MS, 10 * 60 * 1000);
assert.equal(AVATAR_SYNC_POLL_WINDOW_MS, 2 * 60 * 1000);

// --- Avatar poll after Apify metrics when creator avatar still missing ---
const recentMetricsAttempt = new Date(Date.now() - 30_000).toISOString();
assert.equal(
  publicationsNeedAvatarSyncPoll([
    {
      metrics_refresh_status: "completed",
      metrics_provider: "apify",
      influencer_id: "inf-1",
      creator_avatar_url: null,
      metrics_refresh_attempted_at: recentMetricsAttempt,
      created_at: recentMetricsAttempt,
      content_url: "https://www.tiktok.com/@shimasaber8/video/1",
      screenshot_captured_at: null,
    },
  ]),
  true,
  "recent Apify sync without avatar should keep polling"
);
assert.equal(
  publicationsNeedAvatarSyncPoll([
    {
      metrics_refresh_status: "completed",
      metrics_provider: "apify",
      influencer_id: "inf-1",
      creator_avatar_url: "https://p16-va.tiktokcdn.com/avatar.jpg",
      metrics_refresh_attempted_at: recentMetricsAttempt,
      created_at: recentMetricsAttempt,
      content_url: "https://www.tiktok.com/@shimasaber8/video/1",
      screenshot_captured_at: null,
    },
  ]),
  false,
  "avatar resolved should stop avatar poll"
);
assert.equal(
  publicationsNeedAvatarSyncPoll([
    {
      metrics_refresh_status: "collecting",
      metrics_provider: "apify",
      influencer_id: "inf-1",
      creator_avatar_url: null,
      metrics_refresh_attempted_at: recentMetricsAttempt,
      created_at: recentMetricsAttempt,
      content_url: "https://www.tiktok.com/@shimasaber8/video/1",
      screenshot_captured_at: null,
    },
  ]),
  false,
  "in-flight metrics poll covers collecting state"
);

// --- Loading toast only on transition into in-flight ---
assert.equal(shouldShowMetricsSyncLoadingToast(null, "queued"), true);
assert.equal(shouldShowMetricsSyncLoadingToast("pending", "queued"), true);
assert.equal(shouldShowMetricsSyncLoadingToast("queued", "collecting"), false);
assert.equal(shouldShowMetricsSyncLoadingToast("collecting", "collecting"), false);
assert.equal(shouldShowMetricsSyncLoadingToast(null, "pending"), false);
assert.equal(shouldShowMetricsSyncLoadingToast("completed", "queued"), true);

// --- Complete loading toast on terminal status, including remount / first-observation race ---
assert.equal(
  shouldCompleteMetricsSyncToast({
    priorStatus: "queued",
    nextStatus: "completed",
    toastWasShown: false,
  }),
  true,
  "in-flight prior to completed should finish the toast"
);
assert.equal(
  shouldCompleteMetricsSyncToast({
    priorStatus: undefined,
    nextStatus: "completed",
    toastWasShown: true,
  }),
  true,
  "Refresh metrics spinner must finish even if first observed status is already terminal"
);
assert.equal(
  shouldCompleteMetricsSyncToast({
    priorStatus: undefined,
    nextStatus: "manual_required",
    toastWasShown: true,
  }),
  true
);
assert.equal(
  shouldCompleteMetricsSyncToast({
    priorStatus: undefined,
    nextStatus: "completed",
    toastWasShown: false,
  }),
  false,
  "page load of already-completed rows must not toast success"
);
assert.equal(
  shouldCompleteMetricsSyncToast({
    priorStatus: "collecting",
    nextStatus: "collecting",
    toastWasShown: true,
  }),
  false
);

// --- Completed metrics without screenshot use separate slower poll ---
const recentAttempt = new Date(Date.now() - 60_000).toISOString();
assert.equal(
  publicationsNeedMetricsSyncPoll([
    {
      metrics_refresh_status: "completed",
      content_url: "https://instagram.com/p/abc",
      screenshot_captured_at: null,
      metrics_refresh_attempted_at: recentAttempt,
      created_at: recentAttempt,
    },
  ]),
  false,
  "completed metrics should not use in-flight poll"
);
assert.equal(
  publicationsNeedScreenshotCapturePoll([
    {
      metrics_refresh_status: "completed",
      content_url: "https://instagram.com/p/abc",
      screenshot_captured_at: null,
      metrics_refresh_attempted_at: recentAttempt,
      created_at: recentAttempt,
    },
  ]),
  true,
  "completed metrics with URL but no screenshot should keep screenshot poll"
);
assert.equal(
  publicationsNeedScreenshotCapturePoll([
    {
      metrics_refresh_status: "completed",
      content_url: "https://instagram.com/p/abc",
      screenshot_captured_at: new Date().toISOString(),
      metrics_refresh_attempted_at: recentAttempt,
      created_at: recentAttempt,
    },
  ]),
  false,
  "screenshot captured should stop screenshot poll"
);
assert.equal(
  publicationsNeedScreenshotCapturePoll([
    {
      metrics_refresh_status: "completed",
      content_url: null,
      screenshot_captured_at: null,
      metrics_refresh_attempted_at: recentAttempt,
      created_at: recentAttempt,
    },
  ]),
  false,
  "no content URL means no screenshot job"
);
const staleAttempt = new Date(Date.now() - SCREENSHOT_CAPTURE_POLL_WINDOW_MS - 1_000).toISOString();
assert.equal(
  publicationsNeedScreenshotCapturePoll([
    {
      metrics_refresh_status: "completed",
      content_url: "https://instagram.com/p/abc",
      screenshot_captured_at: null,
      metrics_refresh_attempted_at: staleAttempt,
      created_at: staleAttempt,
    },
  ]),
  false,
  "stale publications without screenshot should not poll forever"
);

// --- Metrics display: hidden likes (-1) sanitize to empty; comments still show ---
{
  const likes = sanitizeMetricValue(-1);
  const comments = sanitizeMetricValue(108);
  assert.equal(likes, null);
  assert.equal(comments, 108);
  assert.equal(formatCompactCount(likes), "—");
  assert.equal(formatCompactCount(comments), "108");
}

console.log("metrics-sync-poll-policy tests passed");
