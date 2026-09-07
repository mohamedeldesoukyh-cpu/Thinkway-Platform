import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeCategoryFacetLabel,
  isUsefulCategoryFacetLabel,
  mergeCategoryFacetLabels,
  mergeCountryFacetOptions,
  mergeLanguageFacetOptions,
} from "@/lib/discovery/creator-search-filter-facet-merge";

test("mergeCategoryFacetLabels prefers live labels and dedupes case-insensitively", () => {
  assert.deepEqual(
    mergeCategoryFacetLabels(
      [
        { label: "Sports", count: 12 },
        { label: "beauty", count: 40 },
        { label: "  ", count: 1 },
        { label: "fyp", count: 99 },
      ],
      ["Beauty", "Fashion", "Food"]
    ),
    ["Sports", "Beauty", "Fashion", "Food"]
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

test("mergeLanguageFacetOptions dedupes by code", () => {
  assert.deepEqual(
    mergeLanguageFacetOptions(
      [{ code: "AR", label: "Arabic", count: 10 }],
      [
        { code: "en", label: "English" },
        { code: "ar", label: "Arabic" },
      ]
    ),
    [
      { code: "ar", label: "Arabic" },
      { code: "en", label: "English" },
    ]
  );
});

test("canonicalizeCategoryFacetLabel maps to Discovery canonical labels", () => {
  assert.equal(canonicalizeCategoryFacetLabel("sports"), "Sports");
  assert.equal(canonicalizeCategoryFacetLabel("#Beauty"), "Beauty");
});

test("isUsefulCategoryFacetLabel rejects spam and account-type tags", () => {
  assert.equal(isUsefulCategoryFacetLabel("Sports"), true);
  assert.equal(isUsefulCategoryFacetLabel("fyp"), false);
  assert.equal(isUsefulCategoryFacetLabel("Digital creator"), false);
  assert.equal(isUsefulCategoryFacetLabel("None"), false);
  assert.equal(isUsefulCategoryFacetLabel("EG"), false);
});
