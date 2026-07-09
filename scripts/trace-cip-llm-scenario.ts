/** LLM-like extraction matching user screenshot symptoms */
import { createEmptyCampaignIntelligenceProfile } from "../features/campaign-intelligence-profile/types/profile";
import { normalizeFromProfile } from "../features/campaign-intelligence-profile/services/normalization/normalize-from-profile";
import { profileToDiscoveryRequirements } from "../features/campaign-intelligence-profile/services/discovery-campaign-requirements";
import { mapCampaignIntelligenceToDiscoverySearch } from "../features/campaign-intelligence-profile/services/discovery-search-mapping/map-campaign-intelligence";

const llmLike = {
  ...createEmptyCampaignIntelligenceProfile(),
  brandName: "L'Oréal ParisMa",
  clientName: "L'Oréal ParisMa",
  market: "EgyptCampaign Duration 5 weeks",
  geography: ["Egypt", "United Arab Emirates", "Saudi Arabia"],
  platforms: ["instagram", "tiktok"],
  audienceDetail: { gender: "Female", ageMin: 25, ageMax: 40, countries: ["Egypt"] },
  creatorCategories: ["Beauty", "Audience", "20k-500k followers"],
  creatorNiches: ["skincare", "vitamin c"],
  sources: {
    brandName: "brief" as const,
    geography: "brief" as const,
    platforms: "brief" as const,
    audience: "brief" as const,
  },
  confidence: { brandName: 0.85, geography: 0.85, platforms: 0.85, audience: 0.85 },
  rawBriefExcerpt:
    "L'Oréal Paris Premium Skincare Campaign Brief. Brand: L'Oréal Paris. Market: Egypt. Platforms: Instagram, TikTok.",
};

const piped = normalizeFromProfile(llmLike);
const ui = profileToDiscoveryRequirements(piped.profile);
const mapping = mapCampaignIntelligenceToDiscoverySearch(piped.profile);

console.log("=== LLM-LIKE SCENARIO (user screenshot) ===\n");
console.log("UI requirements:", JSON.stringify(ui, null, 2));
console.log("\nExtraction issues:", JSON.stringify(piped.extractionIssues, null, 2));
console.log("\nNormalized brand:", piped.normalizedEntities.brand);
console.log("\nNormalized market:", piped.normalizedEntities.market);
console.log("\nNormalized audience countries:", piped.normalizedEntities.audience.countries);
console.log("\nDiscovery filters:", mapping.filters.map((f) => `${f.key}=${f.value}`));
