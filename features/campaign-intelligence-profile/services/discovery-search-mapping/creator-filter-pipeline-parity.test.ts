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

// Campaign/audience geography never becomes creator eligibility in either consumer.
assert.deepEqual(discoveryCreatorFilters.countries, []);
assert.equal(discoveryCreatorFilters.gender, "");
assert.equal(discoveryCreatorFilters.ageMin, "");
assert.equal(discoveryCreatorFilters.ageMax, "");
assert.ok(discoveryCreatorFilters.categories.includes("Beauty"));
assert.equal(discoveryCreatorFilters.contentKeyword, "", "soft topics must not become hard filters");
assert.deepEqual(discoveryCreatorFilters.audienceInterestTags, []);
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
