import assert from "node:assert/strict";
import test from "node:test";

import { discoveryMappedFiltersToCreatorFilters } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/mapped-filters-to-discovery";

import {
  DEFAULT_CREATOR_SEARCH_FILTERS,
  clearCreatorSearchSectionFilters,
  cloneCreatorSearchFilters,
  filtersToBrowseParams,
} from "./creator-search-types";

test("cloneCreatorSearchFilters copies array fields without sharing references", () => {
  const clone = cloneCreatorSearchFilters();
  clone.platforms.push("tiktok");
  assert.deepEqual(DEFAULT_CREATOR_SEARCH_FILTERS.platforms, []);
});

test("discoveryMappedFiltersToCreatorFilters does not mutate DEFAULT_CREATOR_SEARCH_FILTERS", () => {
  const mapped = discoveryMappedFiltersToCreatorFilters([
    {
      id: "platform-1",
      key: "platform",
      label: "Social Platform",
      value: "tiktok",
      weight: 100,
      confidence: 0.9,
    },
  ]);

  assert.deepEqual(mapped.platforms, ["tiktok"]);
  assert.deepEqual(DEFAULT_CREATOR_SEARCH_FILTERS.platforms, []);
});

test("filtersToBrowseParams omits platform filter when platforms array is empty", () => {
  const params = filtersToBrowseParams(cloneCreatorSearchFilters(), 1, 50);
  assert.equal(params.platform, undefined);
  assert.equal(params.platforms, undefined);
});

test("filtersToBrowseParams normalizes platform aliases", () => {
  const params = filtersToBrowseParams(
    {
      ...cloneCreatorSearchFilters(),
      platforms: ["TT"],
    },
    1,
    50
  );
  assert.equal(params.platform, "tiktok");
});

test("clearCreatorSearchSectionFilters clears all creator categories at once", () => {
  const cleared = clearCreatorSearchSectionFilters("creator", {
    ...cloneCreatorSearchFilters(),
    countries: ["EG"],
    platforms: ["instagram"],
    categories: ["Beauty", "Fashion", "Fitness"],
  });

  assert.deepEqual(cleared.categories, []);
  assert.deepEqual(cleared.countries, []);
  assert.deepEqual(cleared.platforms, []);
});

test("clearCreatorSearchSectionFilters clears all content tags at once", () => {
  const cleared = clearCreatorSearchSectionFilters("content", {
    ...cloneCreatorSearchFilters(),
    contentKeyword: "skincare",
    contentTags: ["beauty", "makeup"],
    contentLanguages: ["en"],
  });

  assert.equal(cleared.contentKeyword, "");
  assert.deepEqual(cleared.contentTags, []);
  assert.deepEqual(cleared.contentLanguages, []);
});
