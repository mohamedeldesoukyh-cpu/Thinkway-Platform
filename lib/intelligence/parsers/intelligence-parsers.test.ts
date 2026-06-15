import assert from "node:assert/strict";

import { normalizeExcelHeader } from "@/lib/intelligence/parsers/header-normalize";
import { harmonizeCampaignRow } from "@/lib/intelligence/parsers/harmonize";
import { parseMoney } from "@/lib/intelligence/parsers/money";
import { parsePercent } from "@/lib/intelligence/parsers/percent";
import { isCampaignDataRow, isDatabaseDataRow } from "@/lib/intelligence/parsers/row-filter";

assert.equal(parseMoney("$2,024 "), 2024);
assert.equal(parseMoney("799$"), 799);
assert.equal(parseMoney("1,333$"), 1333);
assert.equal(parseMoney("8,325.50"), 8325.5);
assert.equal(parseMoney("(1,200)"), -1200);
assert.equal(parseMoney("١٬٢٠٠"), 1200);
assert.equal(parseMoney(""), null);
assert.equal(parseMoney("N/A"), null);

assert.equal(parsePercent("37%"), 37);
assert.equal(parsePercent("58.62 %"), 58.62);
assert.equal(parsePercent(0.37), 37);
assert.equal(parsePercent(""), null);

assert.equal(normalizeExcelHeader(" Revenue ($) ROI "), "revenue ( $ ) roi");
assert.equal(normalizeExcelHeader("Revenue ($) ROI"), "revenue ( $ ) roi");
assert.equal(normalizeExcelHeader("Revenue($)ROI"), "revenue ( $ ) roi");
assert.equal(normalizeExcelHeader("  our   cost  "), "our cost");
assert.equal(normalizeExcelHeader("Our Cost ($)"), "our cost ( $ )");

assert.equal(isCampaignDataRow({ INFLUENCER: "Bashayer Hamad" }, "2026"), true);
assert.equal(isCampaignDataRow({ "Profit ($)": "500" }, "2024"), false);
assert.equal(
  isCampaignDataRow({ "Campaign Name": "Trendyol", Month: "Jan-23", INFLUENCER: "x" }, "2023"),
  true
);
assert.equal(
  isCampaignDataRow({ " Revenue ($) ROI ": "$500", INFLUENCER: "x" }, "2023"),
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

const row2023 = harmonizeCampaignRow(
  "2023",
  {
    " Revenue ($) ROI ": "$2,024",
    "our cost": "$1,500",
    INFLUENCER: "Test Influencer",
    "Campaign Name": "Trendyol",
    Month: "Jan-23",
    Entity: "KSA",
  },
  10
);
assert.equal(row2023.revenue_usd, 2024);
assert.equal(row2023.cost_usd, 1500);
assert.equal(row2023.gp_usd, 524);

const row2023AltHeader = harmonizeCampaignRow(
  "2023",
  {
    "Revenue($)ROI": "$8,325",
    "Our Cost($)": "$5,000",
    INFLUENCER: "Alt Header Test",
    "Campaign Name": "Sample",
    Month: "Feb-23",
  },
  11
);
assert.equal(row2023AltHeader.revenue_usd, 8325);
assert.equal(row2023AltHeader.cost_usd, 5000);

console.log("intelligence-parsers.test.ts: all assertions passed");
