import assert from "node:assert/strict";
import test from "node:test";

import {
  assertOfflineImportMayPromoteToEnriched,
  isProfileIdentityCommerciallyReady,
  resolveOfflineImportEnrichmentStatus,
} from "@/lib/discovery/enrichment-staging";

test("offline Instagram post-only import cannot promote to enriched", () => {
  const status = resolveOfflineImportEnrichmentStatus({
    platform: "instagram",
    followers: 0,
    audienceCountry: null,
    countryCode: null,
    countryCodes: null,
    profileDetailsSatisfied: false,
  });

  assert.equal(status, "awaiting_profile_details");
  assert.equal(
    assertOfflineImportMayPromoteToEnriched({
      platform: "instagram",
      followers: 0,
      audienceCountry: null,
      countryCode: null,
      profileDetailsSatisfied: false,
    }),
    false
  );
});

test("offline Instagram with profile details + country promotes to enriched", () => {
  const status = resolveOfflineImportEnrichmentStatus({
    platform: "instagram",
    followers: 12_000,
    audienceCountry: "EG",
    countryCode: "EG",
    countryCodes: ["EG"],
    profileDetailsSatisfied: true,
  });

  assert.equal(status, "enriched");
  assert.equal(
    isProfileIdentityCommerciallyReady({
      platform: "instagram",
      followers: 12_000,
      audienceCountry: "EG",
      countryCode: "EG",
      profileDetailsSatisfied: true,
    }),
    true
  );
});

test("profile details without country can become ready when marked unavailable", () => {
  assert.equal(
    isProfileIdentityCommerciallyReady({
      platform: "instagram",
      followers: 5_000,
      audienceCountry: null,
      countryCode: null,
      profileDetailsSatisfied: true,
      countryAvailability: "unavailable",
    }),
    true
  );

  assert.equal(
    resolveOfflineImportEnrichmentStatus({
      platform: "instagram",
      followers: 5_000,
      audienceCountry: null,
      countryCode: null,
      profileDetailsSatisfied: true,
      countryAvailability: "unavailable",
    }),
    "enriched"
  );
});

test("import country code alone does not skip profile-details stage", () => {
  // Country from CSV without profile-details still awaits followers/details.
  const status = resolveOfflineImportEnrichmentStatus({
    platform: "instagram",
    followers: null,
    audienceCountry: null,
    importCountryCode: "EG",
    countryCode: "EG",
    profileDetailsSatisfied: false,
  });
  assert.equal(status, "awaiting_profile_details");
});
