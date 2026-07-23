import assert from "node:assert/strict";

import {
  buildCoverageAcquisitionDedupeKey,
  normalizeCoverageDedupeCategories,
  normalizeCoverageDedupeToken,
} from "./coverage-acquisition-dedupe";
import type { DiscoveryJobPayload } from "./types";

function testNormalizeToken() {
  assert.equal(normalizeCoverageDedupeToken("  EG "), "eg");
  assert.equal(normalizeCoverageDedupeToken("Beauty & Care"), "beautycare");
  assert.equal(normalizeCoverageDedupeToken(undefined), "");
}

function testNormalizeCategoriesStable() {
  assert.equal(
    normalizeCoverageDedupeCategories(["Sports", "Fitness", "sports"]),
    "fitness+sports"
  );
  assert.equal(normalizeCoverageDedupeCategories([]), "-");
  assert.equal(normalizeCoverageDedupeCategories(undefined), "-");
}

function testSameCoverageSameKey() {
  const a: DiscoveryJobPayload = {
    method: "location",
    platform: "instagram",
    locationCountry: "EG",
    locationQuery: "adidasegypt",
    hashtag: "adidasegypt",
    coverageIntent: {
      country: "EG",
      categories: ["Sports", "Fitness"],
      platforms: ["instagram"],
    },
  };
  const b: DiscoveryJobPayload = {
    method: "location",
    platform: "Instagram",
    locationCountry: "eg",
    locationQuery: "AdidasEgypt",
    hashtag: "AdidasEgypt",
    coverageIntent: {
      country: "EG",
      categories: ["Fitness", "Sports"],
      platforms: ["instagram"],
    },
  };

  assert.equal(buildCoverageAcquisitionDedupeKey(a), buildCoverageAcquisitionDedupeKey(b));
  assert.equal(
    buildCoverageAcquisitionDedupeKey(a),
    "acq:instagram:eg:fitness+sports:location:adidasegypt"
  );
}

function testDifferentPlatformDifferentKey() {
  const base: DiscoveryJobPayload = {
    method: "location",
    platform: "instagram",
    locationCountry: "EG",
    hashtag: "skincare",
    coverageIntent: { country: "EG", categories: ["Beauty"] },
  };
  const tiktok: DiscoveryJobPayload = { ...base, platform: "tiktok" };
  assert.notEqual(
    buildCoverageAcquisitionDedupeKey(base),
    buildCoverageAcquisitionDedupeKey(tiktok)
  );
}

function testDifferentSeedDifferentKey() {
  const a: DiscoveryJobPayload = {
    method: "hashtag",
    platform: "instagram",
    hashtag: "running",
    coverageIntent: { categories: ["Sports"] },
  };
  const b: DiscoveryJobPayload = {
    ...a,
    hashtag: "cycling",
  };
  assert.notEqual(buildCoverageAcquisitionDedupeKey(a), buildCoverageAcquisitionDedupeKey(b));
}

function run() {
  testNormalizeToken();
  testNormalizeCategoriesStable();
  testSameCoverageSameKey();
  testDifferentPlatformDifferentKey();
  testDifferentSeedDifferentKey();
  console.log("lib/discovery/coverage-acquisition-dedupe.test.ts — all tests passed");
}

run();
