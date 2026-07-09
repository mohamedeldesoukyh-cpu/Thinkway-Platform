import assert from "node:assert/strict";

import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { createEmptyCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { profileToDiscoveryRequirements } from "@/features/campaign-intelligence-profile/services/discovery-campaign-requirements";
import { normalizeFromProfile } from "@/features/campaign-intelligence-profile/services/normalization";
import { mapCampaignIntelligenceToDiscoverySearch } from "./map-campaign-intelligence";
import { CIP_FIELDS_EXCLUDED_FROM_DISCOVERY } from "./types";

const rawProfile: CampaignIntelligenceProfile = {
  ...createEmptyCampaignIntelligenceProfile(),
  brandName: "L'Oréal Paris",
  campaignName: "Vitamin C Launch",
  objectives: ["Awareness"],
  deliverables: ["Reels"],
  budget: { amount: 100000, currency: "EGP" },
  kpis: ["Reach"],
  platforms: ["instagram", "tiktok"],
  market: "Egypt",
  rawBriefExcerpt: "L'Oréal Paris skincare campaign in Egypt on Instagram and TikTok",
  sources: {
    geography: "brief",
    platforms: "brief",
    audience: "brief",
    brandName: "brief",
  },
  confidence: {
    geography: 0.9,
    platforms: 0.9,
    audience: 0.88,
    brandName: 0.9,
  },
  audienceDetail: {
    gender: "Female",
    ageMin: 25,
    ageMax: 45,
    countries: ["EG"],
  },
  creatorCategories: ["Beauty", "20k-500k followers"],
  creatorNiches: ["skincare", "vitamin c"],
};

const { profile } = normalizeFromProfile(rawProfile);
assert.ok(profile.validatedIntelligence, "must have validatedIntelligence SSOT");

const { filters, skipped } = mapCampaignIntelligenceToDiscoverySearch(profile);

assert.ok(filters.some((f) => f.key === "platform" && f.value === "instagram"));
assert.ok(filters.some((f) => f.key === "platform" && f.value === "tiktok"));
assert.ok(filters.some((f) => f.key === "audience_country" && f.value === "EG"));
assert.ok(filters.some((f) => f.key === "creator_country" && f.value === "EG"));
assert.ok(filters.some((f) => f.key === "audience_gender" && f.value === "female"));
assert.ok(filters.some((f) => f.key === "category" && f.value === "Beauty"));
assert.ok(!filters.some((f) => f.label.toLowerCase().includes("budget")));
assert.ok(!filters.some((f) => f.label.toLowerCase().includes("deliverable")));
assert.ok(!filters.some((f) => f.label.toLowerCase().includes("objective")));
assert.ok(!filters.some((f) => f.label.toLowerCase().includes("kpi")));
assert.ok(!filters.some((f) => f.value.includes("L'Oréal")));
assert.ok(!filters.some((f) => f.value.includes("Audience")));
assert.ok(!filters.some((f) => f.value === "AE"), "UAE must not appear in Discovery");
assert.ok(!filters.some((f) => f.value === "SA"), "SA must not appear in Discovery");
assert.ok(!filters.some((f) => f.value === "QA"), "Qatar must not appear in Discovery");

const uiReq = profileToDiscoveryRequirements(profile);
assert.equal(uiReq.brandName, "L'Oréal Paris");
assert.equal(uiReq.marketCountry, "EG");
assert.ok(uiReq.platforms.includes("instagram"));
assert.ok(uiReq.platforms.includes("tiktok"));
assert.equal(uiReq.audienceGender, "female");
assert.equal(uiReq.audienceAgeMin, "25");
assert.ok(uiReq.categories.includes("Beauty"));
assert.ok(!uiReq.brandName.includes("ParisMa"));

assert.ok(CIP_FIELDS_EXCLUDED_FROM_DISCOVERY.includes("brandName"));

// Profile without validatedIntelligence returns empty Discovery mapping
const emptyMapping = mapCampaignIntelligenceToDiscoverySearch(createEmptyCampaignIntelligenceProfile());
assert.equal(emptyMapping.filters.length, 0);

console.log("discovery-search-mapping.test.ts — passed", { count: filters.length, skipped });
