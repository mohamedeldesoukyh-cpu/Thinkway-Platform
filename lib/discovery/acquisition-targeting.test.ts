import assert from "node:assert/strict";

import {
  buildGeoTargetedAcquisitionSeeds,
  buildGeoTargetedAcquisitionSeedsFromIntent,
} from "./acquisition-targeting";

const lorealSeeds = buildGeoTargetedAcquisitionSeeds({
  country: "EG",
  categories: ["Beauty"],
  niches: ["skincare", "vitamin c"],
  audience: "skincare vitamin c Beauty skincare",
});

assert.equal(lorealSeeds.primaryHashtag, "skincareegypt");
assert.ok(lorealSeeds.fallbackHashtags.includes("egyptskincare"));
assert.equal(lorealSeeds.locationCountry, "EG");
assert.equal(lorealSeeds.nicheToken, "skincare");

const fromIntent = buildGeoTargetedAcquisitionSeedsFromIntent({
  country: "EG",
  categories: ["Beauty"],
  niches: ["skincare"],
  audience: "skincare vitamin c",
});

assert.equal(fromIntent.primaryHashtag, "skincareegypt");

const generic = buildGeoTargetedAcquisitionSeeds({
  categories: ["Beauty"],
  audience: "skincare routines",
});

assert.equal(generic.primaryHashtag, "skincare");

console.log("lib/discovery/acquisition-targeting.test.ts — all tests passed");
