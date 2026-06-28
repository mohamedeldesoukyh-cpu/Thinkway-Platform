import assert from "node:assert/strict";

import {
  mergeSourcedFields,
  normalizeDemographics,
  hasDemographics,
  type IncomingField,
} from "@/lib/creator-enrichment/merge";

// ---------------------------------------------------------------------------
// Transparency: every written field records its source (spec §11)
// ---------------------------------------------------------------------------
{
  const incoming: IncomingField[] = [
    { field: "follower_count", value: 12000, source: "apify" },
    { field: "profile_bio", value: "Beauty creator", source: "apify" },
  ];
  const result = mergeSourcedFields({}, incoming);
  assert.deepEqual(result.updates, {
    follower_count: 12000,
    profile_bio: "Beauty creator",
  });
  assert.equal(result.fieldSources.follower_count, "apify");
  assert.equal(result.fieldSources.profile_bio, "apify");
  assert.deepEqual(result.fieldsUpdated.sort(), ["follower_count", "profile_bio"]);
}

// ---------------------------------------------------------------------------
// MANUAL PROTECTION: manual fields are NEVER overwritten by automation (§11)
// ---------------------------------------------------------------------------
{
  const existingSources = { follower_count: "manual" as const, profile_bio: "apify" as const };
  const incoming: IncomingField[] = [
    { field: "follower_count", value: 99999, source: "apify" },
    { field: "profile_bio", value: "Updated bio", source: "apify" },
  ];
  const result = mergeSourcedFields(existingSources, incoming);
  assert.equal(
    "follower_count" in result.updates,
    false,
    "manual follower_count must NOT be overwritten by apify"
  );
  assert.deepEqual(result.manualProtected, ["follower_count"]);
  assert.equal(result.fieldSources.follower_count, "manual", "source stays manual");
  assert.equal(result.updates.profile_bio, "Updated bio", "non-manual field still updates");
  assert.equal(result.fieldSources.profile_bio, "apify");
}

// A manual write CAN overwrite a manual field (operator override).
{
  const result = mergeSourcedFields(
    { follower_count: "manual" },
    [{ field: "follower_count", value: 500, source: "manual" }]
  );
  assert.equal(result.updates.follower_count, 500);
  assert.deepEqual(result.manualProtected, []);
}

// ---------------------------------------------------------------------------
// Never overwrite with empty / null
// ---------------------------------------------------------------------------
{
  const result = mergeSourcedFields(
    {},
    [
      { field: "profile_bio", value: null, source: "apify" },
      { field: "hashtags", value: [], source: "apify" },
      { field: "profile_display_name", value: "   ", source: "apify" },
      { field: "following_count", value: 0, source: "apify" },
    ]
  );
  assert.equal("profile_bio" in result.updates, false, "null not written");
  assert.equal("hashtags" in result.updates, false, "empty array not written");
  assert.equal("profile_display_name" in result.updates, false, "blank string not written");
  assert.equal(result.updates.following_count, 0, "numeric 0 IS a valid value");
}

// ---------------------------------------------------------------------------
// Demographics: NULL -> 'unavailable' and NEVER invented (spec §6)
// ---------------------------------------------------------------------------
{
  const cols = normalizeDemographics(null);
  assert.equal(cols.demographic_source, "unavailable");
  assert.equal(cols.audience_age_18_24, null);
  assert.equal(cols.audience_gender_female, null);
  assert.equal(cols.audience_top_countries, null);
  assert.equal(hasDemographics(cols), false);
}

// Declared source but no actual numbers => still 'unavailable' (never invent)
{
  const cols = normalizeDemographics({ source: "modash", age: {}, gender: {} });
  assert.equal(cols.demographic_source, "unavailable");
  assert.equal(cols.audience_age_25_34, null);
}

// Real data -> typed columns + provider source
{
  const cols = normalizeDemographics({
    source: "modash",
    age: { "18_24": 40.5, "25_34": 35 },
    gender: { female: 62, male: 38 },
    topCountries: [{ code: "AE", name: "United Arab Emirates", percent: 55 }],
    topCities: [{ name: "Dubai", percent: 30 }],
  });
  assert.equal(cols.demographic_source, "modash");
  assert.equal(cols.audience_age_18_24, 40.5);
  assert.equal(cols.audience_gender_female, 62);
  assert.equal(cols.audience_top_countries?.[0]?.code, "AE");
  assert.equal(hasDemographics(cols), true);
}

// IMPORTED PROTECTION: imported fields are NEVER overwritten by automation
{
  const result = mergeSourcedFields(
    { follower_count: "imported" },
    [{ field: "follower_count", value: 99999, source: "apify" }],
    { existingValues: { follower_count: 10000 }, fillMissingOnly: true }
  );
  assert.equal("follower_count" in result.updates, false);
  assert.deepEqual(result.manualProtected, ["follower_count"]);
}

// Fill-missing-only: apify-sourced metrics may refresh; import/manual values stay.
{
  const result = mergeSourcedFields(
    { follower_count: "apify" },
    [{ field: "follower_count", value: 99999, source: "apify" }],
    { existingValues: { follower_count: 50000 }, fillMissingOnly: true }
  );
  assert.equal(result.updates.follower_count, 99999);
}

// Fill-missing-only: empty fields accept Apify data.
{
  const result = mergeSourcedFields(
    {},
    [{ field: "avg_views", value: 12000, source: "apify" }],
    { existingValues: { avg_views: null }, fillMissingOnly: true }
  );
  assert.equal(result.updates.avg_views, 12000);
}

// Fill-missing-only: non-apify existing values are preserved.
{
  const result = mergeSourcedFields(
    {},
    [{ field: "profile_bio", value: "Apify bio", source: "apify" }],
    { existingValues: { profile_bio: "CSV bio" }, fillMissingOnly: true }
  );
  assert.equal("profile_bio" in result.updates, false);
}

console.log("creator-enrichment merge tests passed");
