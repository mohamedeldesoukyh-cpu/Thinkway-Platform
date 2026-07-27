/**
 * Regression: offline Instagram imports must not reach final enrichment state
 * without completing the profile-details stage.
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { ApifyProfileData } from "@/lib/creator-enrichment/types";
import { shouldBackfillInstagramProfileDetails } from "@/lib/discovery/apify-import-profile-backfill";
import {
  assertOfflineImportMayPromoteToEnriched,
  hasUsableFollowerCount,
  resolveOfflineImportEnrichmentStatus,
} from "@/lib/discovery/enrichment-staging";

const POST_ONLY = [{ id: "post-1", playCount: 12_000 }];

function postOnlyNormalized(overrides: Partial<ApifyProfileData> = {}): ApifyProfileData {
  return {
    platform: "instagram",
    username: "offline_creator",
    profileUrl: "https://www.instagram.com/offline_creator/",
    displayName: "Offline Creator",
    bio: null,
    followers: null,
    following: null,
    postsCount: null,
    engagementRate: null,
    avgViews: 1000,
    avgLikes: 10,
    avgComments: 1,
    isVerified: false,
    profilePictureUrl: null,
    audienceCountry: null,
    hashtags: [],
    mentions: [],
    categories: [],
    recentPublications: [],
    contactEmail: null,
    contactPhone: null,
    contactLinks: [],
    apifyRunId: "run-offline",
    ...overrides,
  } as ApifyProfileData;
}

/** Mirrors import pipeline status resolution used by ensureIdentityCreatorFromApifyData. */
function resolveImportStatus(
  normalized: ApifyProfileData,
  profileRowsCount: number,
  importCountryCode?: string | null
) {
  const profileDetailsSatisfied =
    profileRowsCount > 0 || hasUsableFollowerCount(normalized.followers);

  return resolveOfflineImportEnrichmentStatus({
    platform: "instagram",
    followers: normalized.followers,
    audienceCountry: normalized.audienceCountry,
    countryCode: importCountryCode ?? normalized.audienceCountry,
    countryCodes: importCountryCode || normalized.audienceCountry
      ? [importCountryCode ?? normalized.audienceCountry!].filter(Boolean)
      : null,
    importCountryCode,
    profileDetailsSatisfied,
  });
}

test("post-only offline Instagram import stays awaiting_profile_details (not enriched)", () => {
  const normalized = postOnlyNormalized();
  assert.equal(
    shouldBackfillInstagramProfileDetails("instagram", [], POST_ONLY, normalized),
    true,
    "post-only missing followers/country must request profile-details backfill"
  );

  const status = resolveImportStatus(normalized, /* profileRowsCount */ 0);
  assert.equal(status, "awaiting_profile_details");
  assert.equal(
    assertOfflineImportMayPromoteToEnriched({
      platform: "instagram",
      followers: normalized.followers,
      audienceCountry: normalized.audienceCountry,
      profileDetailsSatisfied: false,
    }),
    false
  );
});

test("failed/skipped profile-details backfill cannot be finalized as enriched", () => {
  // Simulate: backfill did not add profile rows and still has no followers/country.
  const normalized = postOnlyNormalized({ followers: 0, audienceCountry: null });
  const status = resolveImportStatus(normalized, 0);
  assert.notEqual(status, "enriched");
  assert.equal(status, "awaiting_profile_details");
});

test("successful profile-details with country may promote to enriched", () => {
  const normalized = postOnlyNormalized({
    followers: 42_000,
    audienceCountry: "PT",
    bio: "Based in Portugal",
  });
  const status = resolveImportStatus(normalized, /* profileRowsCount */ 1);
  assert.equal(status, "enriched");
});

test("shouldBackfill when country missing even if followers present on normalized stub", () => {
  const normalized = postOnlyNormalized({
    followers: 100,
    audienceCountry: null,
  });
  assert.equal(
    shouldBackfillInstagramProfileDetails("instagram", [], POST_ONLY, normalized),
    true
  );
});
