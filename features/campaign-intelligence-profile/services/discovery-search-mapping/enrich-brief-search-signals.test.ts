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

console.log("enrich-brief-search-signals tests passed");
