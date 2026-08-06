import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  formatCampaignTargetMarketLabel,
  readCampaignTargetMarket,
  resolveCampaignTargetMarketDisplay,
} from "./target-market";

test("readCampaignTargetMarket prefers metadata over empty", () => {
  assert.equal(readCampaignTargetMarket({ target_market: "AE" }), "AE");
  assert.equal(readCampaignTargetMarket({ target_market: "  " }), null);
  assert.equal(readCampaignTargetMarket({}), null);
});

test("formatCampaignTargetMarketLabel maps ISO codes", () => {
  assert.equal(formatCampaignTargetMarketLabel("AE"), "United Arab Emirates");
  assert.equal(formatCampaignTargetMarketLabel("EG"), "Egypt");
});

test("resolveCampaignTargetMarketDisplay uses campaign over client country", () => {
  assert.equal(
    resolveCampaignTargetMarketDisplay({
      campaignMetadata: { target_market: "AE" },
      clientCountry: "Egypt",
    }),
    "United Arab Emirates"
  );
  assert.equal(
    resolveCampaignTargetMarketDisplay({
      campaignMetadata: {},
      clientCountry: "Egypt",
    }),
    "Egypt"
  );
});
