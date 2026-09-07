import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeCategoryFacetLabels,
  mergeCountryFacetOptions,
} from "@/lib/discovery/creator-search-filter-facet-merge";

test("mergeCategoryFacetLabels prefers live labels and dedupes case-insensitively", () => {
  assert.deepEqual(
    mergeCategoryFacetLabels(
      [
        { label: "Sports", count: 12 },
        { label: "beauty", count: 40 },
        { label: "  ", count: 1 },
      ],
      ["Beauty", "Fashion", "Food"]
    ),
    ["Sports", "beauty", "Fashion", "Food"]
  );
});

test("mergeCategoryFacetLabels falls back to seeds when live is empty", () => {
  assert.deepEqual(mergeCategoryFacetLabels([], ["Beauty", "Food"]), [
    "Beauty",
    "Food",
  ]);
});

test("mergeCountryFacetOptions dedupes by ISO code and keeps live first", () => {
  assert.deepEqual(
    mergeCountryFacetOptions(
      [
        { code: "eg", label: "Egypt", count: 100 },
        { code: "AE", label: "UAE", count: 20 },
      ],
      [
        { code: "EG", label: "Egypt" },
        { code: "SA", label: "Saudi Arabia" },
      ]
    ),
    [
      { code: "EG", label: "Egypt" },
      { code: "AE", label: "UAE" },
      { code: "SA", label: "Saudi Arabia" },
    ]
  );
});
