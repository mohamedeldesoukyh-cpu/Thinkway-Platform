import assert from "node:assert/strict";

import {
  collectAvatarCandidates,
  audienceInterestListFromCreator,
  filterPlatformsForDisplay,
  mergeCreatorInterestTags,
  resolveDefaultMetricsPlatformAccountId,
  resolvePrimaryAvatar,
  sortPlatformsStable,
} from "./creator-centric";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function testResolvePrimaryAvatarManualWins() {
  const result = resolvePrimaryAvatar([
    { url: "https://tiktokcdn.example/a.jpg", source: "tiktok" },
    { url: "https://uploads.example/manual.jpg", source: "uploaded" },
    { url: "https://cdninstagram.example/manual.jpg", source: "manual" },
    { url: "https://cdninstagram.example/ig.jpg", source: "instagram" },
  ]);
  assert.equal(result.source, "manual");
  assert.ok(result.url?.includes("cdninstagram.example/manual.jpg"));
}

function testResolvePrimaryAvatarInstagramBeforeTikTok() {
  const result = resolvePrimaryAvatar([
    { url: "https://tiktokcdn.example/a.jpg", source: "tiktok" },
    { url: "https://cdninstagram.example/ig.jpg", source: "instagram" },
  ]);
  assert.equal(result.source, "instagram");
}

function testSortPlatformsStable() {
  const sorted = sortPlatformsStable([
    { id: "2", platform: "tiktok" },
    { id: "1", platform: "instagram" },
    { id: "3", platform: "youtube" },
  ]);
  assert.deepEqual(
    sorted.map((p) => p.platform),
    ["instagram", "tiktok", "youtube"]
  );
}

function testFilterPlatformsForDisplay() {
  const platforms = [
    { id: "ig", platform: "instagram", follower_count: 1000 },
    { id: "tt", platform: "tiktok", follower_count: 5000 },
    { id: "yt", platform: "youtube", follower_count: 2000 },
  ];

  assert.deepEqual(
    filterPlatformsForDisplay(platforms).map((p) => p.platform),
    ["instagram", "tiktok", "youtube"]
  );

  assert.deepEqual(
    filterPlatformsForDisplay(platforms, ["tiktok"]).map((p) => p.platform),
    ["tiktok"]
  );

  assert.deepEqual(
    filterPlatformsForDisplay(platforms, ["instagram", "tiktok"]).map((p) => p.platform),
    ["instagram", "tiktok"]
  );

  assert.deepEqual(filterPlatformsForDisplay(platforms, ["twitter"]), []);
}

function testResolveDefaultMetricsPlatformAccountId() {
  const stored = resolveDefaultMetricsPlatformAccountId(
    [
      { id: "ig", platform: "instagram", follower_count: 1000 },
      { id: "tt", platform: "tiktok", follower_count: 5000 },
    ],
    "ig"
  );
  assert.equal(stored, "ig");

  const defaulted = resolveDefaultMetricsPlatformAccountId([
    { id: "tt", platform: "tiktok", follower_count: 5000 },
    { id: "ig", platform: "instagram", follower_count: 1000 },
  ]);
  assert.equal(defaulted, "ig");
}

function testMergeCreatorInterestTags() {
  const merged = mergeCreatorInterestTags({
    influencerCategories: ["Beauty"],
    accounts: [
      {
        interest_categories: ["beauty", "Skincare"],
        metadata: { audience_interests: ["Fashion"] },
      },
      { interest_categories: ["Fashion"], metadata: { niche: "Lifestyle" } },
    ],
  });
  assert.deepEqual(merged.map((v) => v.toLowerCase()).sort(), [
    "beauty",
    "fashion",
    "lifestyle",
    "skincare",
  ]);
}

function testCollectAvatarCandidates() {
  const candidates = collectAvatarCandidates({
    storedPrimaryAvatarUrl: "https://cdninstagram.example/stored.jpg",
    storedPrimaryAvatarSource: "instagram",
    accounts: [],
    storedPrimaryMode: "all",
  });
  assert.ok(candidates.some((c) => c.url?.includes("stored.jpg")));
}

function testMultiPlatformNullAvatarSourceDoesNotBeatInstagram() {
  const result = resolvePrimaryAvatar(
    collectAvatarCandidates({
      accounts: [
        {
          id: "tt",
          platform: "tiktok",
          profile_picture_url: "https://p16-sign-va.tiktokcdn.com/expired.jpg",
          avatar_source: null,
        },
        {
          id: "ig",
          platform: "instagram",
          profile_picture_url: "https://cdninstagram.example/ig.jpg",
          avatar_source: "apify",
        },
      ],
    })
  );
  assert.equal(result.source, "instagram");
  assert.ok(result.url?.includes("cdninstagram.example"));
}

function testBrowseIgnoresStaleStoredPlatformPrimary() {
  const result = resolvePrimaryAvatar(
    collectAvatarCandidates({
      storedPrimaryAvatarUrl: "https://p16-sign-va.tiktokcdn.com/stale.jpg",
      storedPrimaryAvatarSource: "tiktok",
      accounts: [
        {
          id: "ig",
          platform: "instagram",
          profile_picture_url: "https://cdninstagram.example/ig.jpg",
          avatar_source: "apify",
        },
      ],
      storedPrimaryMode: "operator",
    })
  );
  assert.equal(result.source, "instagram");
}

function testBrowsePrefersFreshPlatformAvatarOverStaleStoredInstagramPrimary() {
  const expiredOe = Math.floor(Date.now() / 1000 - 3600).toString(16);
  const result = resolvePrimaryAvatar(
    collectAvatarCandidates({
      storedPrimaryAvatarUrl: `https://scontent-lax7-1.cdninstagram.com/v/stale.jpg?oe=${expiredOe}`,
      storedPrimaryAvatarSource: "instagram",
      accounts: [
        {
          id: "ig",
          platform: "instagram",
          profile_picture_url: "https://scontent-lga3-2.cdninstagram.com/v/fresh.jpg",
          avatar_source: "apify",
        },
      ],
      storedPrimaryMode: "operator",
    })
  );
  assert.equal(result.source, "instagram");
  assert.ok(result.url?.includes("fresh.jpg"));
}

function testBrowseKeepsDurableUploadedOverApifyCdn() {
  const result = resolvePrimaryAvatar(
    collectAvatarCandidates({
      storedPrimaryAvatarUrl:
        "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/pdf-crop.png",
      storedPrimaryAvatarSource: "uploaded",
      accounts: [
        {
          id: "ig",
          platform: "instagram",
          profile_picture_url: "https://scontent.cdninstagram.com/v/apify-photo.jpg",
          avatar_source: "apify",
        },
      ],
      storedPrimaryMode: "operator",
    })
  );
  assert.equal(result.source, "uploaded");
  assert.ok(
    result.url?.includes("/creator-avatars/"),
    "durable Thinkway avatar must win over ephemeral Apify CDN"
  );
}

function testBrowseKeepsExpiredStoredPrimaryWhenNoBetterCandidate() {
  const expiredOe = Math.floor(Date.now() / 1000 - 3600).toString(16);
  const expired = `https://scontent.cdninstagram.com/v/stale.jpg?oe=${expiredOe}`;
  const result = resolvePrimaryAvatar(
    collectAvatarCandidates({
      storedPrimaryAvatarUrl: expired,
      storedPrimaryAvatarSource: "instagram",
      accounts: [],
      storedPrimaryMode: "operator",
    })
  );
  assert.equal(result.source, "instagram");
  assert.ok(result.url?.includes("stale.jpg"));
}

function testPrefersEnrichmentUploadOverPdfImportCrop() {
  const result = resolvePrimaryAvatar(
    collectAvatarCandidates({
      storedPrimaryAvatarUrl:
        "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/file/instagram/ali.mahgub.jpg",
      storedPrimaryAvatarSource: "uploaded",
      accounts: [
        {
          id: "ig",
          platform: "instagram",
          profile_picture_url:
            "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/file/instagram/ali.mahgub.jpg",
          avatar_source: "uploaded",
        },
        {
          id: "tt",
          platform: "tiktok",
          profile_picture_url:
            "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/inf/tiktok/ali.mahgoub8.jpg",
          avatar_source: "uploaded",
        },
      ],
      storedPrimaryMode: "all",
    })
  );
  assert.ok(
    result.url?.includes("/creator-avatars/enrichment/"),
    "enrichment avatar should win over PDF import crop"
  );
}

function testAudienceInterestListFromCreatorSkipsStoredCategories() {
  const creator = {
    ai_category: null,
    ai_niche: null,
    categories: ["Beauty", "Fashion"],
    browse_category_tags: ["Beauty"],
    audience_interests: ["Camera & Photography", "Restaurants, Food & Grocery"],
  } as UnifiedCreatorResult;

  assert.deepEqual(audienceInterestListFromCreator(creator), [
    "Camera & Photography",
    "Restaurants, Food & Grocery",
  ]);
}

testResolvePrimaryAvatarManualWins();
testResolvePrimaryAvatarInstagramBeforeTikTok();
testSortPlatformsStable();
testFilterPlatformsForDisplay();
testResolveDefaultMetricsPlatformAccountId();
testMergeCreatorInterestTags();
testCollectAvatarCandidates();
testBrowseKeepsDurableUploadedOverApifyCdn();
testBrowseKeepsExpiredStoredPrimaryWhenNoBetterCandidate();
testPrefersEnrichmentUploadOverPdfImportCrop();
testMultiPlatformNullAvatarSourceDoesNotBeatInstagram();
testBrowseIgnoresStaleStoredPlatformPrimary();
testBrowsePrefersFreshPlatformAvatarOverStaleStoredInstagramPrimary();
testAudienceInterestListFromCreatorSkipsStoredCategories();

console.log("creator-centric.test.ts: all tests passed");
