import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreatorCountryWriteFromApifyProfile,
  buildInfluencerCountryWrite,
  extractCountryCodesFromText,
  inferCountriesFromProfileSignals,
  mergeCountryCodes,
} from "@/lib/creators/country-inference";

test("extractCountryCodesFromText parses slash-separated bio locations", () => {
  assert.deepEqual(
    extractCountryCodesFromText("Swiss / Dubai / Phuket"),
    ["CH", "AE", "TH"]
  );
});

test("extractCountryCodesFromText resolves country names and aliases", () => {
  assert.deepEqual(extractCountryCodesFromText("Based in United Arab Emirates"), ["AE"]);
  assert.deepEqual(extractCountryCodesFromText("Cairo creator"), ["EG"]);
  assert.deepEqual(extractCountryCodesFromText("🇵🇹Based in Portugal"), ["PT"]);
});

test("extractCountryCodesFromText reads regional-indicator flag emojis", () => {
  assert.deepEqual(extractCountryCodesFromText("iTravel✈️\n🇪🇬~🇫🇷"), ["EG", "FR"]);
  assert.deepEqual(extractCountryCodesFromText("Islam Fawzy 🇪🇬\nVideo creator"), ["EG"]);
});

test("inferCountriesFromProfileSignals scans bio and display name", () => {
  assert.deepEqual(
    inferCountriesFromProfileSignals({
      bio: "Founder in Dubai · Swiss passport",
      displayName: "Nik | Dubai",
    }),
    ["AE", "CH"]
  );
});

test("mergeCountryCodes dedupes while preserving order", () => {
  assert.deepEqual(
    mergeCountryCodes(["AE"], "CH", ["AE", "TH"], null),
    ["AE", "CH", "TH"]
  );
});

test("buildInfluencerCountryWrite merges existing and incoming codes", () => {
  assert.deepEqual(
    buildInfluencerCountryWrite({
      existingCountryCode: "EG",
      existingCountryCodes: ["EG"],
      incomingCodes: ["AE", ["CH"]],
    }),
    { country_code: "EG", country_codes: ["EG", "AE", "CH"] }
  );
});

test("buildInfluencerCountryWrite returns null when unchanged", () => {
  assert.equal(
    buildInfluencerCountryWrite({
      existingCountryCode: "AE",
      existingCountryCodes: ["AE", "CH"],
      incomingCodes: ["AE"],
    }),
    null
  );
});

test("buildInfluencerCountryWrite preserves primary when sparse re-enrichment adds nothing", () => {
  assert.equal(
    buildInfluencerCountryWrite({
      existingCountryCode: "AE",
      existingCountryCodes: ["AE", "CH", "TH"],
      incomingCodes: [[]],
    }),
    null
  );
});

test("buildInfluencerCountryWrite merges new countries without dropping existing", () => {
  assert.deepEqual(
    buildInfluencerCountryWrite({
      existingCountryCode: "AE",
      existingCountryCodes: ["AE", "CH"],
      incomingCodes: [["TH"]],
    }),
    { country_code: "AE", country_codes: ["AE", "CH", "TH"] }
  );
});

test("buildInfluencerCountryWrite keeps existing primary after merge", () => {
  assert.deepEqual(
    buildInfluencerCountryWrite({
      existingCountryCode: "AE",
      existingCountryCodes: ["AE"],
      incomingCodes: [["CH", "TH"]],
    }),
    { country_code: "AE", country_codes: ["AE", "CH", "TH"] }
  );
});

test("buildCreatorCountryWriteFromApifyProfile uses fallback bio from open-graph", () => {
  assert.deepEqual(
    buildCreatorCountryWriteFromApifyProfile({
      existingCountryCode: null,
      existingCountryCodes: null,
      audienceCountry: null,
      bio: null,
      fallbackBio: "Swiss / Dubai / Phuket",
      displayName: "Nik",
      handle: "nikcars",
    }),
    { country_code: "CH", country_codes: ["CH", "AE", "TH"] }
  );
});

test("buildCreatorCountryWriteFromApifyProfile merges Apify audience country", () => {
  assert.deepEqual(
    buildCreatorCountryWriteFromApifyProfile({
      existingCountryCode: null,
      existingCountryCodes: null,
      audienceCountry: "AE",
      bio: "Swiss creator",
      displayName: "Nik",
    }),
    { country_code: "AE", country_codes: ["AE", "CH"] }
  );
});
