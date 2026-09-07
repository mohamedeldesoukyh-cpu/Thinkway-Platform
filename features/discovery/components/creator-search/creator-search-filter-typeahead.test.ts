import assert from "node:assert/strict";
import test from "node:test";

import {
  filterFacetOptionsByDraft,
  resolveFacetDraftToOption,
} from "@/features/discovery/components/creator-search/creator-search-filter-typeahead";

test("filterFacetOptionsByDraft narrows chips by substring", () => {
  assert.deepEqual(
    filterFacetOptionsByDraft(
      ["Beauty", "Beauty & Cosmetics", "Sports", "Food"],
      "cosm",
      (label) => label
    ),
    ["Beauty & Cosmetics"]
  );
});

test("filterFacetOptionsByDraft returns all when draft empty", () => {
  assert.deepEqual(
    filterFacetOptionsByDraft(["Beauty", "Sports"], "  ", (label) => label),
    ["Beauty", "Sports"]
  );
});

test("resolveFacetDraftToOption maps unique partial to chip label", () => {
  assert.equal(
    resolveFacetDraftToOption("cosm", [
      "Beauty",
      "Beauty & Cosmetics",
      "Sports",
    ]),
    "Beauty & Cosmetics"
  );
});

test("resolveFacetDraftToOption keeps typed value when ambiguous", () => {
  assert.equal(
    resolveFacetDraftToOption("be", ["Beauty", "Beauty & Cosmetics"]),
    "be"
  );
});
