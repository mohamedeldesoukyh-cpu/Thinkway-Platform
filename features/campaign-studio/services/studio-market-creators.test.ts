import assert from "node:assert/strict";
import { test } from "node:test";

import {
  studioCreatorHomeCountryLabel,
  vendorCountryMatchesCampaignMarkets,
  vendorMatchesCampaignMarket,
} from "./studio-market-creators";

test("Egypt market keeps Egypt creators and drops UAE-only creators", () => {
  assert.equal(vendorCountryMatchesCampaignMarkets("Egypt", ["Egypt"]), true);
  assert.equal(vendorCountryMatchesCampaignMarkets("Egypt · Italy", ["Egypt"]), true);
  assert.equal(vendorCountryMatchesCampaignMarkets("UAE", ["Egypt"]), false);
  assert.equal(vendorCountryMatchesCampaignMarkets("United Arab Emirates", ["Egypt"]), false);
  assert.equal(vendorCountryMatchesCampaignMarkets("UAE · Egypt", ["Egypt"]), false);
  assert.equal(vendorCountryMatchesCampaignMarkets("—", ["Egypt"]), false);
  assert.equal(vendorCountryMatchesCampaignMarkets(undefined, ["Egypt"]), false);
});

test("UAE market keeps UAE creators", () => {
  assert.equal(vendorCountryMatchesCampaignMarkets("UAE", ["UAE"]), true);
  assert.equal(vendorCountryMatchesCampaignMarkets("Egypt", ["UAE"]), false);
});

test("primary country_code wins over audience-blended display labels", () => {
  assert.equal(
    vendorMatchesCampaignMarket(
      { country: "Egypt · UAE", countryCode: "AE" },
      ["Egypt"]
    ),
    false
  );
  assert.equal(
    vendorMatchesCampaignMarket(
      { country: "UAE · Egypt", countryCode: "EG" },
      ["Egypt"]
    ),
    true
  );
});

test("audience-only country codes are not treated as home", () => {
  assert.equal(
    studioCreatorHomeCountryLabel({
      countryCodes: ["AE", "EG"],
      audienceCountries: ["EG"],
    }),
    "United Arab Emirates"
  );
  assert.equal(
    vendorMatchesCampaignMarket(
      { countryCodes: ["AE", "EG"], audienceCountries: ["EG"] },
      ["Egypt"]
    ),
    false
  );
  assert.equal(
    vendorMatchesCampaignMarket(
      {
        countryCodes: ["EG", "AE"],
        estimatedCountry: "EG",
        audienceCountries: ["EG"],
      },
      ["Egypt"]
    ),
    false
  );
  assert.equal(
    vendorMatchesCampaignMarket(
      { countryCodes: ["EG"], audienceCountries: ["EG"] },
      ["Egypt"]
    ),
    false
  );
});
