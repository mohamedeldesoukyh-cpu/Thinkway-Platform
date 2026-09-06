import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATOR_SEARCH_FILTER_TRUTH_MATRIX,
  resolveBrowseHydrationExtras,
  creatorSearchPricingFilterSupported,
} from "@/lib/creators/creator-search-filter-truth";

test("truth matrix is non-empty and pricing disabled", () => {
  assert.ok(CREATOR_SEARCH_FILTER_TRUTH_MATRIX.length >= 10);
  assert.equal(creatorSearchPricingFilterSupported(), false);
});

test("unfiltered hydration extras are all false", () => {
  assert.deepEqual(resolveBrowseHydrationExtras({}), {
    includeLanguages: false,
    includeDemographics: false,
    includePublicationDates: false,
  });
});
