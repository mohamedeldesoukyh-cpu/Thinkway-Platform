import assert from "node:assert/strict";

import { parseMoney } from "@/lib/intelligence/parsers/money";
import { parsePercent } from "@/lib/intelligence/parsers/percent";
import { isCampaignDataRow, isDatabaseDataRow } from "@/lib/intelligence/parsers/row-filter";
import { harmonizeCampaignRow } from "@/lib/intelligence/parsers/harmonize";

assert.equal(parseMoney("$2,024 "), 2024);
assert.equal(parseMoney("8,325.50"), 8325.5);
assert.equal(parseMoney("(1,200)"), -1200);
assert.equal(parseMoney("١٬٢٠٠"), 1200);
assert.equal(parseMoney(""), null);
assert.equal(parseMoney("N/A"), null);

assert.equal(parsePercent("37%"), 37);
assert.equal(parsePercent("58.62 %"), 58.62);
assert.equal(parsePercent(0.37), 37);
assert.equal(parsePercent(""), null);

assert.equal(isCampaignDataRow({ INFLUENCER: "Bashayer Hamad" }, "2026"), true);
assert.equal(isCampaignDataRow({ "Profit ($)": "500" }, "2024"), false);
assert.equal(
  isCampaignDataRow({ "Campaign Name": "Trendyol", Month: "Jan-23", INFLUENCER: "x" }, "2023"),
  true
);
assert.equal(isDatabaseDataRow({ Username: "lio_" }), true);
assert.equal(isDatabaseDataRow({}), false);

const row = harmonizeCampaignRow(
  "2025",
  {
    "Camp#": "Camp-75",
    "Code#": "MH-1",
    "Revenue ($) ROI": "$1,692",
    "Cost ($)": "$1,066.67",
    "Profit Margin %": "37%",
    INFLUENCER: "Hanan Al ghamdi",
    Channel: "snapchat",
    Date: "2025-07-01",
  },
  2
);
assert.equal(row.source_line_id, "2025|Camp-75|MH-1");
assert.equal(row.revenue_usd, 1692);
assert.equal(row.cost_usd, 1066.67);
assert.equal(row.margin_pct, 37);
assert.equal(row.channel, "Snapchat");

console.log("intelligence-parsers.test.ts: all assertions passed");
