import assert from "node:assert/strict";

import { parsePlainTextStructured } from "./parse-text";
import { serializeStructuredBrief } from "./serialize";

/** L'Oréal Premium Skincare brief — flattened mammoth failure mode. */
const LOREAL_FLATTENED = `
L'Oréal Premium Skincare Campaign Brief

Client / Brand Name : L'Oréal Paris
Market : Egypt
Campaign Name : Vitamin C Serum Launch
Campaign Country : Egypt
Campaign Duration : 5 weeks
Campaign Objectives : Engagement, UGC, Brand awareness
Social Platforms : Instagram, TikTok
Creator Type Preferences : Beauty, skincare specialists, micro-influencers, 20k-500k followers
Audience Preferences : Women 25–40 interested in premium skincare
Content Keywords : vitamin c, serum, brightening, anti-aging
Deliverables : Reels, Stories, UGC posts
Budget : EUR 600,000
KPIs : Engagement rate 3%, Reach 2M
`.trim();

const doc = parsePlainTextStructured(LOREAL_FLATTENED, "docx");
const llmText = serializeStructuredBrief(doc);

assert.ok(doc.sections.length > 0, "must have sections");
assert.ok(
  doc.sections.some((s) => s.blocks.some((b) => b.type === "table")),
  "must parse key-value lines as table"
);

const tableBlock = doc.sections
  .flatMap((s) => s.blocks)
  .find((b) => b.type === "table");
assert.ok(tableBlock && tableBlock.type === "table");

const brandRow = tableBlock.rows.find((r) => /brand/i.test(r[0] ?? ""));
assert.ok(brandRow, "must have brand row");
assert.equal(brandRow![1], "L'Oréal Paris", "brand must not be concatenated with Market");
assert.ok(!brandRow![1]!.includes("ParisMarket"), "no ParisMarket concatenation");

const marketRow = tableBlock.rows.find((r) => /^market$/i.test(r[0]?.trim() ?? ""));
assert.ok(marketRow, "must have market row");
assert.equal(marketRow![1], "Egypt");
assert.ok(!marketRow![1]!.includes("Campaign Duration"), "market must not include duration");

assert.ok(llmText.includes("L'Oréal Paris"), "LLM text includes brand");
assert.ok(llmText.includes("Market -> Egypt") || llmText.includes("Market : Egypt"), "LLM text includes market");
assert.ok(!llmText.includes("ParisMarket"), "LLM text must not contain ParisMarket");
assert.ok(!llmText.includes("EgyptCampaign"), "LLM text must not contain EgyptCampaign");

console.log("structured-brief-parser.test.ts — passed", {
  sections: doc.sections.length,
  tableRows: tableBlock.rows.length,
});
