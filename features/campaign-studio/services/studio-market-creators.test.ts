import assert from "node:assert/strict";
import { test } from "node:test";

import { vendorCountryMatchesCampaignMarkets } from "./studio-market-creators";

test("Egypt market keeps Egypt creators and drops UAE-only creators", () => {
  assert.equal(vendorCountryMatchesCampaignMarkets("Egypt", ["Egypt"]), true);
  assert.equal(vendorCountryMatchesCampaignMarkets("Egypt · Italy", ["Egypt"]), true);
  assert.equal(vendorCountryMatchesCampaignMarkets("UAE", ["Egypt"]), false);
  assert.equal(vendorCountryMatchesCampaignMarkets("United Arab Emirates", ["Egypt"]), false);
  assert.equal(vendorCountryMatchesCampaignMarkets("UAE · Egypt", ["Egypt"]), false);
  assert.equal(vendorCountryMatchesCampaignMarkets("—", ["Egypt"]), true);
  assert.equal(vendorCountryMatchesCampaignMarkets(undefined, ["Egypt"]), true);
});

test("UAE market keeps UAE creators", () => {
  assert.equal(vendorCountryMatchesCampaignMarkets("UAE", ["UAE"]), true);
  assert.equal(vendorCountryMatchesCampaignMarkets("Egypt", ["UAE"]), false);
});
