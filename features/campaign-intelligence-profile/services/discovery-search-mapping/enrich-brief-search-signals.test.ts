import assert from "node:assert/strict";

import type { CampaignIntelligenceProfile } from "../../types/profile";
import { enrichBriefSearchSignals, fixBrandDisplayName } from "./enrich-brief-search-signals";

const etisalatProfile: CampaignIntelligenceProfile = {
  schemaVersion: 1,
  status: "saved",
  extractedAt: new Date().toISOString(),
  confidence: {},
  sources: {},
  brandName: "E& / Etisalat",
  market: "Egypt",
  rawBriefExcerpt:
    "Etisalat E& 5G campaign targeting Gen Z in Egypt on TikTok. Drive youth awareness for mobile and gaming.",
  objectives: ["Drive 5G awareness among Gen Z"],
  geography: ["EG"],
};

const enriched = enrichBriefSearchSignals(etisalatProfile, { filters: [], skipped: [] });

assert.ok(enriched.filters.some((f) => f.key === "platform" && f.value === "tiktok"));
assert.ok(enriched.filters.some((f) => f.key === "content_keyword" && f.value === "5G"));
assert.ok(enriched.filters.some((f) => f.key === "content_keyword" && f.value.toLowerCase() === "gaming"));
assert.ok(enriched.filters.some((f) => f.key === "audience_age_min" && f.value === "18"));
assert.equal(fixBrandDisplayName("E& / Esalat"), "E& / Etisalat");

const beautyProfile: CampaignIntelligenceProfile = {
  schemaVersion: 1,
  status: "saved",
  extractedAt: new Date().toISOString(),
  confidence: {},
  sources: {},
  brandName: "L'Oréal Paris",
  market: "Egypt",
  platforms: ["instagram", "tiktok"],
  rawBriefExcerpt:
    "L'Oréal Paris Beauty Launch in Egypt. Instagram and TikTok beauty creators, skincare category.",
  creatorCategories: [],
  geography: ["EG"],
};

const beautyEnriched = enrichBriefSearchSignals(beautyProfile, {
  filters: [
    {
      id: "p1",
      key: "platform",
      label: "Social Platform",
      value: "instagram",
      confidence: 0.9,
      weight: 100,
    },
    {
      id: "c1",
      key: "creator_country",
      label: "Creator Country",
      value: "EG",
      confidence: 0.9,
      weight: 90,
    },
  ],
  skipped: [],
});
assert.ok(
  beautyEnriched.filters.some((f) => f.key === "category" && f.value === "Beauty"),
  "thin beauty briefs must enrich preferred Beauty category"
);

const beautyWithLifestyle = enrichBriefSearchSignals(beautyProfile, {
  filters: [
    {
      id: "cat-b",
      key: "category",
      label: "Category",
      value: "Beauty",
      confidence: 0.9,
      weight: 100,
    },
    {
      id: "cat-l",
      key: "category",
      label: "Category",
      value: "Lifestyle",
      confidence: 0.7,
      weight: 90,
    },
  ],
  skipped: [],
});
assert.ok(
  beautyWithLifestyle.filters.some((f) => f.key === "category" && f.value === "Beauty")
);
assert.ok(
  !beautyWithLifestyle.filters.some(
    (f) => f.key === "category" && f.value.toLowerCase() === "lifestyle"
  ),
  "Lifestyle must not remain a preferred category alongside Beauty"
);

const arabBankProfile: CampaignIntelligenceProfile = {
  schemaVersion: 1,
  status: "saved",
  extractedAt: new Date().toISOString(),
  confidence: {},
  sources: {},
  brandName: "Arab Bank",
  clientName: "Arab Bank",
  campaignName: "Credit Card Instant Issuance",
  industry: "Finance & Banking",
  market: "Egypt",
  audience: "mass audience",
  objectives: [
    "Drive awareness of Credit Card Instant Issuance and acquire new bank customers",
  ],
  creatorCategories: ["Finance"],
  rawBriefExcerpt:
    "Arab Bank new credit card instant issuance. Targeting a mass audience. Follow a similar approach and utilize as strong mix as the previous LaLiga event.",
  geography: ["EG"],
};

const arabBankEnriched = enrichBriefSearchSignals(arabBankProfile, {
  filters: [
    {
      id: "cat-finance",
      key: "category",
      label: "Category",
      value: "Finance",
      confidence: 0.9,
      weight: 100,
    },
  ],
  skipped: [],
});
const arabBankCategories = arabBankEnriched.filters
  .filter((filter) => filter.key === "category")
  .map((filter) => filter.value);
assert.ok(arabBankCategories.includes("Sports"), `got ${arabBankCategories.join(", ")}`);
assert.ok(arabBankCategories.includes("Lifestyle"), `got ${arabBankCategories.join(", ")}`);
assert.ok(arabBankCategories.includes("Entertainment"), `got ${arabBankCategories.join(", ")}`);
assert.ok(!arabBankCategories.some((value) => /finance|bank/i.test(value)));

console.log("enrich-brief-search-signals tests passed");
