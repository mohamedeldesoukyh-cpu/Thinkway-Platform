import assert from "node:assert/strict";

import {
  audienceFilterFromSearchFields,
  hasAnyAudienceFilter,
  matchesAudienceFilter,
  scoreAudienceMatch,
} from "@/features/discovery/enrichment/audience-filters";
import type { AudienceDemographics } from "@/features/discovery/enrichment/components/audience-demographics-section";

const UNAVAILABLE: AudienceDemographics = {
  age: { "13_17": null, "18_24": null, "25_34": null, "35_44": null, "45_54": null, "55_plus": null },
  gender: { male: null, female: null, unknown: null },
  topCountries: null,
  topCities: null,
  source: "unavailable",
};

const RICH: AudienceDemographics = {
  age: { "13_17": 5, "18_24": 45, "25_34": 30, "35_44": 12, "45_54": 5, "55_plus": 3 },
  gender: { male: 35, female: 63, unknown: 2 },
  topCountries: [
    { code: "AE", name: "United Arab Emirates", percent: 55 },
    { code: "SA", name: "Saudi Arabia", percent: 20 },
  ],
  topCities: [{ name: "Dubai", percent: 30 }],
  source: "modash",
};

// hasAnyAudienceFilter
assert.equal(hasAnyAudienceFilter({}), false);
assert.equal(hasAnyAudienceFilter({ audienceCountry: "AE" }), true);

// No filter => always passes, no score
assert.equal(matchesAudienceFilter(RICH, {}), true);
assert.equal(scoreAudienceMatch(RICH, {}), null);

// Sparse-data passthrough: unavailable demographics never excluded (spec §8)
assert.equal(
  matchesAudienceFilter(UNAVAILABLE, { audienceCountry: "AE", ageGroup: "18_24" }),
  true,
  "missing demographics never excludes a creator"
);
assert.equal(
  scoreAudienceMatch(UNAVAILABLE, { audienceCountry: "AE" }),
  null,
  "no data -> no score (fall back to other signals)"
);

// Country match (code + name fragment)
assert.equal(matchesAudienceFilter(RICH, { audienceCountry: "AE" }), true);
assert.equal(matchesAudienceFilter(RICH, { audienceCountry: "saudi" }), true);
assert.equal(matchesAudienceFilter(RICH, { audienceCountry: "US" }), false);

// Dominant age group (18_24 is the max at 45%)
assert.equal(matchesAudienceFilter(RICH, { ageGroup: "18_24" }), true);
assert.equal(matchesAudienceFilter(RICH, { ageGroup: "25_34" }), false);

// Gender minimum share
assert.equal(
  matchesAudienceFilter(RICH, { genderMinShare: { gender: "female", min: 50 } }),
  true
);
assert.equal(
  matchesAudienceFilter(RICH, { genderMinShare: { gender: "male", min: 50 } }),
  false
);

// Composite score
assert.equal(
  scoreAudienceMatch(RICH, {
    audienceCountry: "AE",
    ageGroup: "18_24",
    genderMinShare: { gender: "female", min: 50 },
  }),
  1,
  "all three criteria satisfied"
);
assert.equal(
  scoreAudienceMatch(RICH, {
    audienceCountry: "US", // miss
    ageGroup: "18_24", // hit
  }),
  0.5
);

// Mapping from existing Phase 2.5 search fields (additive bridge)
{
  const filter = audienceFilterFromSearchFields({
    audienceCountry: "AE",
    gender: "Female",
    ageMin: "18",
    ageMax: "24",
  });
  assert.equal(filter.audienceCountry, "AE");
  assert.equal(filter.ageGroup, "18_24");
  assert.deepEqual(filter.genderMinShare, { gender: "female", min: 50 });
}
{
  const empty = audienceFilterFromSearchFields({});
  assert.equal(hasAnyAudienceFilter(empty), false);
}

console.log("audience-filters tests passed");
