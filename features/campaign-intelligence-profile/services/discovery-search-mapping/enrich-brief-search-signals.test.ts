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

console.log("enrich-brief-search-signals tests passed");
