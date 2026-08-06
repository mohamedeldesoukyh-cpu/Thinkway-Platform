import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCampaignDisplayName } from "@/lib/campaigns/campaign-display-name";

test("resolveCampaignDisplayName strips Campaign and Quotation prefixes", () => {
  assert.equal(
    resolveCampaignDisplayName(
      "Campaign — Quotation — Limitless UAE July - August 2026"
    ),
    "Limitless UAE July - August 2026"
  );
  assert.equal(
    resolveCampaignDisplayName("Quotation — Summer Launch"),
    "Summer Launch"
  );
  assert.equal(resolveCampaignDisplayName("Limitless UAE"), "Limitless UAE");
});
