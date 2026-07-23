import assert from "node:assert/strict";

import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { wrapValue } from "@/features/creator-dna/services/field-envelope";
import { overlayPlatformMetricsFromDna } from "@/lib/creators/dna-browse-hydration";
import { resolveCreatorBrowsePlatformStats } from "@/lib/creators/resolve-browse-display-metrics";
import type { UnifiedCreatorPlatform, UnifiedCreatorResult } from "@/lib/creators/types";

const platforms: UnifiedCreatorPlatform[] = [
  {
    id: "ig-1",
    platform: "instagram",
    handle: "hgabr",
    profile_url: "https://instagram.com/hgabr",
    follower_count: null,
    engagement_rate: 0.4,
    avg_views: 439_900,
    audience_country: "EG",
    is_verified: false,
  },
  {
    id: "tt-1",
    platform: "tiktok",
    handle: "hgabr",
    profile_url: "https://tiktok.com/@hgabr",
    follower_count: 293_100,
    engagement_rate: 0.5,
    avg_views: 447_500,
    audience_country: "EG",
    is_verified: false,
  },
];

const document = createEmptyCreatorDNADocument();
document.identity.platform = wrapValue("instagram", "ipl", 0.9);
document.metrics.followers = wrapValue(639_850, "ipl", 0.9);

const hydrated = overlayPlatformMetricsFromDna(platforms, document);

assert.equal(hydrated[0]?.follower_count, 639_850, "IG followers filled from Creator DNA");
assert.equal(hydrated[1]?.follower_count, 293_100, "TT followers unchanged");

const mismatchDocument = createEmptyCreatorDNADocument();
mismatchDocument.identity.platform = wrapValue("tiktok", "ipl", 0.9);
mismatchDocument.metrics.followers = wrapValue(594_500, "ipl", 0.9);
mismatchDocument.metrics.engagementRate = wrapValue(0.4, "ipl", 0.9);

const mismatchPlatforms: UnifiedCreatorPlatform[] = [
  {
    id: "ig-only",
    platform: "instagram",
    handle: "hgabr",
    profile_url: null,
    follower_count: null,
    engagement_rate: null,
    audience_country: "EG",
    is_verified: false,
  },
];

const mismatchHydrated = overlayPlatformMetricsFromDna(mismatchPlatforms, mismatchDocument);
assert.equal(
  mismatchHydrated[0]?.follower_count,
  594_500,
  "DNA metrics overlay onto primary platform when identity.platform does not match"
);

const creatorStub = {
  unified_id: "inf:test",
  influencer_id: "test",
  discovered_profile_id: null,
  display_name: "hgabr",
  profile_image_url: null,
  primaryAvatarUrl: null,
  platforms: mismatchHydrated,
  metrics: {
    followers: { value: 594_500, confidence: "verified" as const },
    engagement_rate: { value: 0.4, confidence: "verified" as const },
    avg_likes: { value: null, confidence: "estimated" as const },
    avg_comments: { value: null, confidence: "estimated" as const },
    avg_views: { value: null, confidence: "estimated" as const },
    posting_frequency_per_week: { value: null, confidence: "estimated" as const },
  },
} as UnifiedCreatorResult;

const stats = resolveCreatorBrowsePlatformStats(creatorStub);
assert.equal(stats[0]?.followers, 594_500, "Search stats use DNA-hydrated platform followers");
assert.equal(stats[0]?.engagement, 0.4, "Search stats use DNA-hydrated engagement");

const zeroFollowersDocument = createEmptyCreatorDNADocument();
zeroFollowersDocument.identity.platform = wrapValue("tiktok", "ipl", 0.9);
zeroFollowersDocument.metrics.followers = wrapValue(0, "ipl", 0.9);

const zeroHydrated = overlayPlatformMetricsFromDna(
  [
    {
      id: "tt-1",
      platform: "tiktok",
      handle: "karimgaadd",
      profile_url: null,
      follower_count: 58_500,
      engagement_rate: 3.14,
      audience_country: "EG",
      is_verified: false,
    },
  ],
  zeroFollowersDocument
);

assert.equal(
  zeroHydrated[0]?.follower_count,
  58_500,
  "platform followers preserved when DNA followers are zero"
);

console.log("dna-browse-hydration.test.ts: all assertions passed");
