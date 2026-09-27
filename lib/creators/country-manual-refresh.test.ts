import test from "node:test";
import assert from "node:assert/strict";
import { persistCountryFromApifyProfile, persistInfluencerCountryFields } from "./country-persistence";
test("provider country replaces manual country rather than merging it", () => {
  assert.deepEqual(persistCountryFromApifyProfile({ existingCountryCode: "EG", existingCountryCodes: ["EG"], audienceCountry: "United Arab Emirates" }), { country_code: "AE", country_codes: ["AE"] });
});
test("absent provider country retains manual country despite older account or bio", () => {
  assert.deepEqual(persistCountryFromApifyProfile({ existingCountryCode: "EG", existingCountryCodes: ["EG"], audienceCountry: null, platformAudienceCountry: "US", bio: "Dubai" }), null); // unchanged: no database write
});
test("manual choice overwrites country list", () => {
  assert.deepEqual(persistInfluencerCountryFields({ incomingCodes: ["FR"] }), { country_code: "FR", country_codes: ["FR"] });
});
