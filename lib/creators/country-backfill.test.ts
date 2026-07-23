import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCountryWriteFromStoredSignals,
  collectCountryCodesFromExistingData,
} from "@/lib/creators/country-backfill";

test("collectCountryCodesFromExistingData merges platform, DNA, bio inference", () => {
  const result = collectCountryCodesFromExistingData({
    influencer: {
      id: "inf-1",
      display_name: "Nik",
      country_code: null,
      country_codes: null,
      city: null,
      nationality: null,
      audience_top_countries: null,
    },
    platforms: [
      {
        audience_country: "AE",
        profile_bio: "Swiss / Dubai / Phuket",
        profile_display_name: "Nik",
        hashtags: null,
        mentions: null,
      },
    ],
    dnaDocument: {
      audience: {
        country: { value: "AE" },
        countries: { value: ["CH", "TH"] },
      },
    },
    iplAudienceCountries: ["AE"],
  });

  assert.deepEqual(result.codes, ["AE", "CH", "TH"]);
  assert.ok(result.sources.includes("platform.audience_country"));
  assert.ok(result.sources.includes("bio_inference"));
  assert.ok(result.sources.includes("dna.audience.countries"));
});

test("buildCountryWriteFromStoredSignals uses shared merge write", () => {
  const write = buildCountryWriteFromStoredSignals({
    influencer: {
      id: "inf-1",
      display_name: "Nik",
      country_code: null,
      country_codes: null,
      city: null,
      nationality: null,
      audience_top_countries: null,
    },
    platforms: [
      {
        audience_country: null,
        profile_bio: "Swiss / Dubai / Phuket",
        profile_display_name: "Nik",
        hashtags: null,
        mentions: null,
      },
    ],
  });

  assert.deepEqual(write, {
    country_code: "CH",
    country_codes: ["CH", "AE", "TH"],
  });
});
