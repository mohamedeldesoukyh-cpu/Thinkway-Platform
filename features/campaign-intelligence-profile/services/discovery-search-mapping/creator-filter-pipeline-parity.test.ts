import assert from "node:assert/strict";

import { filtersToBrowseParams } from "@/features/discovery/components/creator-search/creator-search-types";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { createEmptyCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { normalizeFromProfile } from "@/features/campaign-intelligence-profile/services/normalization";
import {
  buildBrowseFiltersFromProfile,
  buildCreatorFiltersFromProfile,
  buildSearchStrategyFromProfile,
} from "@/features/campaign-intelligence-profile/services/search-strategy";
import { searchStrategyToCreatorFilters } from "@/features/campaign-intelligence-profile/services/strategy-to-filters";

import {
  discoveryMappedFiltersToBrowseFilters,
  discoveryMappedFiltersToCreatorFilters,
  mapCampaignIntelligenceToDiscoverySearch,
} from "./index";

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

const { filters: mapped } = mapCampaignIntelligenceToDiscoverySearch(profile);
const criteria = buildSearchStrategyFromProfile(profile);

// Studio path
const studioCreatorFilters = discoveryMappedFiltersToCreatorFilters(mapped);
const studioBrowse = discoveryMappedFiltersToBrowseFilters(mapped, 1, 50);

// Discovery path (canonical)
const discoveryCreatorFilters = buildCreatorFiltersFromProfile(profile, criteria);
const discoveryBrowse = buildBrowseFiltersFromProfile(profile, criteria, 1, 50);
const discoveryBrowseViaParams = filtersToBrowseParams(discoveryCreatorFilters, 1, 50);

assert.deepEqual(
  discoveryCreatorFilters,
  studioCreatorFilters,
  "Discovery and Studio must produce identical CreatorSearchFilters"
);
assert.deepEqual(
  discoveryBrowse,
  studioBrowse,
  "Discovery and Studio must produce identical browse params"
);
assert.deepEqual(
  discoveryBrowseViaParams,
  studioBrowse,
  "filtersToBrowseParams on canonical filters must match Studio browse"
);

// ISO country codes preserved (not display labels)
assert.ok(
  discoveryCreatorFilters.countries.includes("EG"),
  "creator country must stay ISO EG"
);
assert.ok(
  !discoveryCreatorFilters.countries.includes("Egypt"),
  "creator country must not use display label Egypt"
);
assert.equal(discoveryBrowse.country, "EG", "browse country must be ISO EG");
assert.notEqual(discoveryBrowse.country, "EGYPT", "browse country must not be corrupted label");

// Gender, age, keywords preserved
assert.equal(discoveryCreatorFilters.gender, "female");
assert.equal(discoveryCreatorFilters.ageMin, "25");
assert.equal(discoveryCreatorFilters.ageMax, "45");
assert.ok(discoveryCreatorFilters.categories.includes("Beauty"));
assert.ok(
  discoveryCreatorFilters.contentKeyword === "skincare" ||
    discoveryCreatorFilters.contentKeyword === "vitamin c" ||
    discoveryCreatorFilters.audienceInterestTags.some((t) =>
      ["skincare", "vitamin c"].includes(t)
    ),
  "keywords/niches must map into canonical filters"
);
assert.ok(discoveryCreatorFilters.platforms.includes("instagram"));
assert.ok(discoveryCreatorFilters.platforms.includes("tiktok"));

if (studioCreatorFilters.minFollowers) {
  assert.equal(discoveryCreatorFilters.minFollowers, studioCreatorFilters.minFollowers);
}
if (studioCreatorFilters.maxFollowers) {
  assert.equal(discoveryCreatorFilters.maxFollowers, studioCreatorFilters.maxFollowers);
}

// Legacy criteria round-trip corrupts country (regression guard)
const legacyFilters = searchStrategyToCreatorFilters(criteria);
const legacyBrowse = filtersToBrowseParams(legacyFilters, 1, 50);
if (legacyBrowse.country && legacyBrowse.country !== "EG") {
  assert.notEqual(
    legacyBrowse.country,
    discoveryBrowse.country,
    "deprecated criteria adapter must not match canonical browse country"
  );
}

// Chip disable: presentation criteria only gates mapped filter ids
const disabledGender = criteria.map((c) =>
  c.label === "Gender" || c.meta?.discoveryKey === "audience_gender"
    ? { ...c, enabled: false }
    : c
);
const withDisabled = buildCreatorFiltersFromProfile(profile, disabledGender);
assert.equal(withDisabled.gender, "", "disabled chip must exclude mapped filter");

console.log("creator-filter-pipeline-parity.test.ts — passed", {
  mappedCount: mapped.length,
  country: discoveryBrowse.country,
  platforms: discoveryCreatorFilters.platforms,
});
