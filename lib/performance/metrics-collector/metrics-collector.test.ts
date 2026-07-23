import assert from "node:assert/strict";

import {
  detectPublicationPlatform,
  providerChainForPlatform,
} from "@/lib/performance/metrics-collector/detect-platform";
import {
  mergeCollectedMetrics,
  hasCoreMetrics,
  metricsRefreshStatusFor,
  sanitizeMetricValue,
  storedMetricsFromPublication,
} from "@/lib/performance/metrics-collector/merge-metrics";
import { mapApifyPayloadToMetrics } from "@/lib/performance/metrics-collector/providers/apify-mapper";
import { outcomeFromAttempts, mergePublicationContentForPersist } from "@/lib/performance/metrics-collector/persist";
import { extractPublicationContentFromApifyRow } from "@/lib/performance/metrics-collector/extract-publication-content";
import { normalizedContentToStorageFields } from "@/lib/performance/content-normalizer";
import { confidenceForCollectedMetrics } from "@/lib/performance/metrics-collector/confidence";
import {
  apifyActorIdForPlatform,
  apifyProfileActorIdForPlatform,
  buildApifyProfileDetailsInput,
  buildApifyRunInput,
} from "@/lib/performance/metrics-collector/providers/apify-input";
import { extractPublicationDateFromProviderRow } from "@/lib/performance/metrics-collector/extract-publication-date";

function detect(url: string, platform: string) {
  return detectPublicationPlatform({
    id: "1",
    campaign_header_id: "c1",
    platform,
    content_url: url,
    external_media_id: null,
    publication_type: platform,
  });
}

{
  const detection = detect(
    "https://www.instagram.com/reel/ABC123xyz/",
    "instagram"
  );
  assert.equal(detection.platform, "instagram");
  assert.equal(detection.mediaId, "ABC123xyz");
}

{
  const detection = detect(
    "https://www.tiktok.com/@creator/video/7398101551744552225",
    "tiktok"
  );
  assert.equal(detection.platform, "tiktok");
  assert.equal(detection.mediaId, "7398101551744552225");
}

{
  const detection = detect(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "youtube"
  );
  assert.equal(detection.platform, "youtube");
  assert.equal(detection.mediaId, "dQw4w9WgXcQ");
}

{
  const detection = detect("https://www.youtube.com/shorts/abc123XYZ", "youtube");
  assert.equal(detection.platform, "youtube");
  assert.equal(detection.mediaId, "abc123XYZ");
}

{
  const detection = detect(
    "https://www.facebook.com/reel/1234567890123456/",
    "facebook"
  );
  assert.equal(detection.platform, "facebook");
  assert.equal(detection.mediaId, "1234567890123456");
}

{
  const detection = detect(
    "https://www.snapchat.com/spotlight/abc123def45",
    "snapchat"
  );
  assert.equal(detection.platform, "snapchat");
  assert.equal(detection.mediaId, "abc123def45");
}

assert.deepEqual(providerChainForPlatform("instagram"), [
  "apify",
  "meta_graph_api",
  "brightdata",
  "playwright",
]);

assert.deepEqual(providerChainForPlatform("tiktok"), [
  "tiktok_api",
  "apify",
  "playwright",
]);

assert.deepEqual(providerChainForPlatform("youtube"), [
  "youtube_data_api",
  "apify",
  "youtube_public_metadata",
]);

assert.deepEqual(providerChainForPlatform("facebook"), [
  "facebook_graph_api",
  "apify",
  "brightdata",
  "playwright",
]);

assert.deepEqual(providerChainForPlatform("snapchat"), [
  "snapchat_api",
  "apify",
  "playwright",
]);

{
  const env = {
    apifyInstagramActorId: "apify/instagram-scraper",
    apifyTikTokActorId: "clockworks/tiktok-scraper",
    apifyFacebookActorId: "apify/facebook-posts-scraper",
    apifyFacebookProfileActorId: "apify/facebook-pages-scraper",
    apifyYouTubeActorId: "streamers/youtube-scraper",
    apifySnapchatActorId: "automation-lab/snapchat-scraper",
  };
  assert.equal(apifyActorIdForPlatform("tiktok", env), "clockworks/tiktok-scraper");
  assert.equal(apifyActorIdForPlatform("facebook", env), "apify/facebook-posts-scraper");
  assert.equal(
    apifyProfileActorIdForPlatform("facebook", env),
    "apify/facebook-pages-scraper"
  );
  assert.equal(
    apifyActorIdForPlatform("snapchat", env),
    "automation-lab/snapchat-scraper"
  );
  assert.ok("postURLs" in buildApifyRunInput("tiktok", "https://tiktok.com/@x/video/1"));
  assert.ok("startUrls" in buildApifyRunInput("facebook", "https://facebook.com/p/1"));
  assert.ok(
    "startUrls" in buildApifyProfileDetailsInput(
      "facebook",
      "https://www.facebook.com/nasaearth"
    )
  );
  assert.deepEqual(
    buildApifyProfileDetailsInput(
      "snapchat",
      "https://www.snapchat.com/add/creator",
      "@creator"
    ),
    { usernames: ["creator"] }
  );
}

{
  const tiktok = mapApifyPayloadToMetrics("tiktok", {
    playCount: 1000,
    diggCount: 50,
    commentCount: 5,
    createTime: 1676464688,
    createTimeISO: "2023-02-15T12:38:08.000Z",
  });
  assert.equal(tiktok?.views, 1000);
  assert.equal(tiktok?.likes, 50);
  assert.equal(tiktok?.comments, 5);
  assert.equal(
    extractPublicationDateFromProviderRow({
      playCount: 1000,
      createTimeISO: "2023-02-15T12:38:08.000Z",
    }),
    "2023-02-15"
  );
}

{
  const youtube = mapApifyPayloadToMetrics("youtube", {
    viewCount: 5000,
    numberOfLikes: 200,
    numberOfComments: 12,
  });
  assert.equal(youtube?.views, 5000);
  assert.equal(youtube?.likes, 200);
  assert.equal(youtube?.comments, 12);
}

{
  const facebook = mapApifyPayloadToMetrics("facebook", {
    videoViewCount: 800,
    likesCount: 40,
    commentsCount: 3,
  });
  assert.equal(facebook?.views, 800);
  assert.equal(facebook?.likes, 40);
}

assert.equal(
  mapApifyPayloadToMetrics("instagram", { error: "not_found", errorDescription: "Post does not exist" }),
  null
);

{
  const instagram = mapApifyPayloadToMetrics("instagram", {
    likesCount: -1,
    commentsCount: 108,
  });
  assert.equal(instagram?.likes, null);
  assert.equal(instagram?.comments, 108);
}

{
  const instagram = mapApifyPayloadToMetrics("instagram", {
    videoPlayCount: 1200,
    edge_media_preview_like: { count: 55 },
    edge_media_to_comment: { count: 12 },
  });
  assert.equal(instagram?.views, 1200);
  assert.equal(instagram?.likes, 55);
  assert.equal(instagram?.comments, 12);
}

assert.equal(confidenceForCollectedMetrics("apify", { comments: 108 }), 70);
assert.equal(
  confidenceForCollectedMetrics("apify", { comments: 108, views: 1000 }),
  90
);

assert.equal(sanitizeMetricValue(-1), null);
assert.equal(sanitizeMetricValue(0), 0);
assert.equal(sanitizeMetricValue(undefined), null);

{
  const commentsOnly = { views: null, likes: null, comments: 108 };
  assert.equal(hasCoreMetrics(commentsOnly), true);
  assert.equal(metricsRefreshStatusFor(commentsOnly), "completed");
}

{
  const reachOnly = { views: null, likes: null, comments: null, reach: 5000 };
  assert.equal(hasCoreMetrics(reachOnly), false);
  assert.equal(metricsRefreshStatusFor(reachOnly), "partial");
}

{
  const outcome = outcomeFromAttempts(
    "pub-1",
    { views: null, likes: null, comments: 108 },
    [{ provider: "apify", available: true, metrics: { comments: 108 } }],
    "apify",
    90
  );
  assert.equal(outcome.status, "completed");
}

{
  const outcome = outcomeFromAttempts(
    "pub-2",
    { views: null, likes: null, comments: null, shares: 12 },
    [{ provider: "apify", available: true, metrics: { shares: 12 } }],
    "apify",
    90
  );
  assert.equal(outcome.status, "partial");
}

{
  const merged = mergeCollectedMetrics(
    { views: 1000, likes: -1 },
    { comments: 10, reach: 900 }
  );
  assert.equal(merged.views, 1000);
  assert.equal(merged.likes, null);
  assert.equal(merged.comments, 10);
  assert.equal(merged.reach, 900);
  assert.equal(merged.engagements, 10);
}

{
  const merged = mergeCollectedMetrics(
    { views: 1000, likes: 50 },
    { views: null, likes: null, comments: 10 }
  );
  assert.equal(merged.views, 1000);
  assert.equal(merged.likes, 50);
  assert.equal(merged.comments, 10);
}

{
  const stored = storedMetricsFromPublication({
    engagement_views: 2200,
    engagement_likes: 88,
    comments: null,
    engagement_comments: 14,
  });
  assert.equal(stored.views, 2200);
  assert.equal(stored.likes, 88);
  assert.equal(stored.comments, 14);
}

{
  const content = extractPublicationContentFromApifyRow("instagram", {
    caption: "Hello #world @friend",
    hashtags: [{ name: "campaign" }],
  });
  assert.ok(content);
  const storage = normalizedContentToStorageFields(content!);
  assert.equal(storage.hashtags, "#campaign");
  assert.equal(storage.mentions, "@friend");
}

{
  const merged = mergePublicationContentForPersist(
    {
      caption: "User caption",
      hashtags: null,
      mentions: null,
      caption_source: "manual",
      hashtags_source: null,
      mentions_source: null,
    },
    {
      caption: "Synced caption",
      hashtags: "#sync",
      mentions: "@brand",
      hashtag_count: 1,
      mention_count: 1,
      caption_source: "sync",
      hashtags_source: "sync",
      mentions_source: "sync",
    }
  );
  assert.equal(merged.caption, undefined);
  assert.equal(merged.hashtags, "#sync");
  assert.equal(merged.mentions, "@brand");
}

console.log("metrics-collector tests passed");
