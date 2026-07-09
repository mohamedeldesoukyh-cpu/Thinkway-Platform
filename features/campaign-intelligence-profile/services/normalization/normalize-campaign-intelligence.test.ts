import assert from "node:assert/strict";

import { createEmptyCampaignIntelligenceProfile } from "../../types/profile";
import { normalizeFromProfile } from "./normalize-from-profile";
import {
  isBadCategoryToken,
  isConcatenatedGarbage,
  isValidCategory,
  isValidBrandName,
  resolveCountryCode,
  sanitizeBrandName,
} from "./validators";
import { briefMentionsCountry } from "./field-provenance";
import { normalizeCampaignIntelligence } from "./normalize-campaign-intelligence";

// --- validators ---

assert.equal(isConcatenatedGarbage("EgyptCampaign Duration"), true);
assert.equal(isConcatenatedGarbage("Egypt"), false);
assert.equal(isBadCategoryToken("Audience"), true);
assert.equal(isValidCategory("Audience"), false);
assert.equal(isValidCategory("Beauty"), true);
assert.equal(resolveCountryCode("Egypt"), "EG");
assert.equal(resolveCountryCode("EG"), "EG");
assert.equal(resolveCountryCode("EgyptCampaign Duration"), null);

assert.equal(sanitizeBrandName("L'Oréal ParisMa"), "L'Oréal Paris");
assert.equal(sanitizeBrandName("L'Oréal Paris"), "L'Oréal Paris");

assert.equal(isValidBrandName("and amplify the Summer 2026"), false);
assert.equal(isValidBrandName("Etisalat"), true);
assert.equal(isValidBrandName("E&"), true);
assert.equal(isValidBrandName("L'Oréal Paris"), true);

assert.equal(briefMentionsCountry("skincare campaign in Egypt for women", "EG"), true);
assert.equal(briefMentionsCountry("skincare campaign in Egypt for women", "AE"), false);

// --- L'Oréal-like brief with garbage mixed in ---

const lorealProfile = {
  ...createEmptyCampaignIntelligenceProfile(),
  brandName: "L'Oréal ParisMa",
  clientName: "L'Oréal",
  campaignName: "Vitamin C Launch",
  market: "EgyptCampaign Duration 5 weeks",
  geography: ["Egypt", "EgyptCampaign Duration", "United Arab Emirates"],
  objectives: ["Engagement and UGC"],
  deliverables: ["Reels", "Stories"],
  budget: { amount: 600_000, currency: "EUR" },
  durationWeeks: 5,
  kpis: ["Engagement rate 3%"],
  platforms: ["instagram", "tiktok"],
  audience: "Women 25–40 interested in skincare",
  audienceDetail: {
    gender: "Female",
    ageMin: 25,
    ageMax: 40,
    countries: ["Egypt"],
  },
  creatorCategories: ["Beauty", "Audience", "20k-500k followers"],
  creatorNiches: ["skincare", "vitamin c"],
  products: ["vitamin c serum"],
  industry: "beauty",
  rawBriefExcerpt:
    "L'Oréal Paris Vitamin C skincare campaign in Egypt for women 25-40. Instagram and TikTok.",
  sources: {
    brandName: "brief" as const,
    geography: "brief" as const,
    platforms: "brief" as const,
    audience: "brief" as const,
  },
  confidence: {
    brandName: 0.9,
    geography: 0.85,
    platforms: 0.9,
    audience: 0.88,
  },
};

const wrapped = normalizeFromProfile(lorealProfile);
const { validatedIntelligence, normalizedEntities, extractionIssues } = wrapped;

assert.equal(validatedIntelligence.brand.brandName, "L'Oréal Paris");
assert.equal(validatedIntelligence.market.countryCode, "EG");
assert.ok(validatedIntelligence.audience.countries.includes("EG"));
assert.ok(!validatedIntelligence.audience.countries.includes("AE"), "UAE must be stripped without brief mention");
assert.equal(validatedIntelligence.audience.gender, "female");
assert.equal(validatedIntelligence.audience.ageMin, 25);
assert.equal(validatedIntelligence.audience.ageMax, 40);
assert.ok(validatedIntelligence.categories.includes("Beauty"));
assert.ok(validatedIntelligence.creator.niches.includes("skincare"));
assert.ok(validatedIntelligence.platforms.includes("instagram"));
assert.ok(!validatedIntelligence.categories.includes("Audience"));
assert.ok(extractionIssues.some((i) => i.rawValue.includes("EgyptCampaign")));
assert.ok(extractionIssues.some((i) => i.rawValue === "Audience"));
assert.ok(
  validatedIntelligence.fieldEvidence["market.countryCode"]?.level !== "inferred",
  "market must not be inferred"
);
assert.ok(
  validatedIntelligence.fieldEvidence["platforms"]?.level === "normalized" ||
    validatedIntelligence.fieldEvidence["platforms"]?.level === "extracted"
);

assert.equal(normalizedEntities.brand.brandName, validatedIntelligence.brand.brandName);

const garbageBrand = normalizeFromProfile({
  ...createEmptyCampaignIntelligenceProfile(),
  brandName: "and amplify the Summer 2026",
  market: "United Arab Emirates",
  platforms: ["tiktok"],
  geography: ["AE"],
  sources: { brandName: "brief", geography: "brief", platforms: "brief" },
  confidence: { brandName: 0.85, geography: 0.9, platforms: 0.9 },
});
assert.equal(garbageBrand.profile.brandName, undefined);
assert.ok(
  garbageBrand.extractionIssues.some(
    (i) => i.field === "brandName" && i.rawValue === "and amplify the Summer 2026"
  )
);

// --- inferred platforms rejected ---

const inferredPlatforms = normalizeFromProfile({
  ...createEmptyCampaignIntelligenceProfile(),
  platforms: ["instagram", "tiktok"],
  geography: ["Egypt"],
  rawBriefExcerpt: "Beauty campaign in Egypt",
  sources: { platforms: "inferred", geography: "brief" },
  confidence: { platforms: 0.6, geography: 0.85 },
});

assert.equal(inferredPlatforms.validatedIntelligence.platforms.length, 0);
assert.ok(
  inferredPlatforms.extractionIssues.some((i) => i.kind === "inferred_rejected" && i.field === "platforms")
);

// --- industry must not infer Beauty category ---

const beautyInference = normalizeCampaignIntelligence({
  ...createEmptyCampaignIntelligenceProfile(),
  industry: "beauty",
  creatorCategories: [],
  geography: ["Egypt"],
  sources: { geography: "brief" },
  confidence: { geography: 0.85 },
});
assert.ok(!beautyInference.normalizedEntities.categories.includes("Beauty"));

console.log("normalize-campaign-intelligence.test.ts — passed", {
  country: validatedIntelligence.market.countryCode,
  audienceCountries: validatedIntelligence.audience.countries,
  categories: validatedIntelligence.categories,
  issues: extractionIssues.length,
});
