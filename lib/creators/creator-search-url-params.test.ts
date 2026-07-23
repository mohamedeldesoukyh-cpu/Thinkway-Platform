import assert from "node:assert/strict";

import {
  applyCreatorSearchFiltersToUrlParams,
  CREATOR_SEARCH_COUNTRY_PARAM,
  CREATOR_SEARCH_QUERY_PARAM,
  creatorSearchFiltersFromUrlParams,
  creatorSearchFiltersUrlEqual,
  filtersFromUrlParams,
} from "./creator-search-url-params";
import { CREATOR_SEARCH_CATEGORY_PARAM } from "./category-filter";

const params = new URLSearchParams();
params.append(CREATOR_SEARCH_CATEGORY_PARAM, "Beauty");
params.append(CREATOR_SEARCH_COUNTRY_PARAM, "eg");
params.set(CREATOR_SEARCH_QUERY_PARAM, "makeup");

const fromUrl = filtersFromUrlParams(params);
assert.deepEqual(fromUrl.categories, ["Beauty"]);
assert.deepEqual(fromUrl.countries, ["EG"]);

const merged = creatorSearchFiltersFromUrlParams(params);
assert.equal(merged.contentKeyword, "");
assert.deepEqual(merged.categories, ["Beauty"]);
assert.deepEqual(merged.countries, ["EG"]);

const roundTrip = new URLSearchParams(params.toString());
applyCreatorSearchFiltersToUrlParams(roundTrip, merged);
assert.equal(roundTrip.get(CREATOR_SEARCH_QUERY_PARAM), "makeup");
assert.deepEqual(roundTrip.getAll(CREATOR_SEARCH_CATEGORY_PARAM), ["Beauty"]);
assert.deepEqual(roundTrip.getAll(CREATOR_SEARCH_COUNTRY_PARAM), ["EG"]);

const withBrief = new URLSearchParams(
  "category=Beauty&country=EG&q=test&profileId=abc&mode=ai"
);
applyCreatorSearchFiltersToUrlParams(withBrief, {
  ...creatorSearchFiltersFromUrlParams(withBrief),
  countries: ["EG", "AE"],
});
assert.equal(withBrief.get("profileId"), "abc");
assert.equal(withBrief.get("mode"), "ai");
assert.equal(withBrief.get(CREATOR_SEARCH_QUERY_PARAM), "test");
assert.deepEqual(withBrief.getAll(CREATOR_SEARCH_COUNTRY_PARAM), ["EG", "AE"]);

const withLanguages = new URLSearchParams("lang=en&lang=ar&contentLang=fr");
const langFilters = filtersFromUrlParams(withLanguages);
assert.deepEqual(langFilters.languages, ["en", "ar"]);
assert.deepEqual(langFilters.contentLanguages, ["fr"]);

const mergedLang = creatorSearchFiltersFromUrlParams(withLanguages);
const langRoundTrip = new URLSearchParams(withLanguages.toString());
applyCreatorSearchFiltersToUrlParams(langRoundTrip, mergedLang);
assert.deepEqual(langRoundTrip.getAll("lang"), ["en", "ar"]);
assert.deepEqual(langRoundTrip.getAll("contentLang"), ["fr"]);

const defaults = creatorSearchFiltersFromUrlParams(new URLSearchParams());
const cleared = new URLSearchParams("country=EG&category=Beauty&platform=instagram");
applyCreatorSearchFiltersToUrlParams(cleared, defaults);
assert.equal(cleared.toString(), "");

assert.equal(
  creatorSearchFiltersUrlEqual(
    creatorSearchFiltersFromUrlParams(
      new URLSearchParams("country=EG&category=Beauty")
    ),
    {
      ...defaults,
      countries: ["EG"],
      categories: ["Beauty"],
    }
  ),
  true
);

console.log("lib/creators/creator-search-url-params.test.ts — passed");
