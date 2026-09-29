import assert from "node:assert/strict";
import test from "node:test";
import { CREATOR_CATEGORY_KEYWORDS } from "./category-keywords";
import { canonicalCategoryLabel, expandCategoryQueryLabels } from "./category-matching";
import { creatorMatchesBrowseCategories } from "./category-filter";
import { canonicalizeCategoryFacetLabel } from "../discovery/creator-search-filter-facet-merge";

test("every keyword family agrees across suggestions, SQL candidates, and final filtering", () => {
  for (const [alias, canonical] of Object.entries(CREATOR_CATEGORY_KEYWORDS)) {
    assert.equal(canonicalizeCategoryFacetLabel(alias), canonical, alias);
    const candidates = expandCategoryQueryLabels([alias]);
    assert.ok(candidates.includes(canonical), alias);
    assert.ok(expandCategoryQueryLabels([canonical]).includes(alias), alias);
    assert.ok(creatorMatchesBrowseCategories({ categories: [canonical] }, [alias]), alias);
    assert.ok(creatorMatchesBrowseCategories({ categories: [], audience_interests: [alias] }, [canonical]), alias);
  }
});

test("reported motherhood filters and hashtag-only interest records agree", () => {
  for (const label of ["momlife", "mom", "momsoftiktok"]) {
    assert.equal(canonicalizeCategoryFacetLabel(label), "Parenting");
    assert.ok(expandCategoryQueryLabels([label]).includes("Parenting"));
    assert.ok(expandCategoryQueryLabels(["Parenting"]).includes(`#${label}`));
    assert.ok(creatorMatchesBrowseCategories({ categories: ["Parenting"] }, [label]));
    assert.ok(creatorMatchesBrowseCategories({ audience_interests: [`#${label}`] }, ["Parenting"]));
  }
});

test("custom labels survive, categories remain OR, and substring guesses are excluded", () => {
  assert.equal(canonicalCategoryLabel(" #Ceramic Art "), "Ceramic Art");
  assert.equal(canonicalCategoryLabel("constructor"), "constructor");
  assert.ok(expandCategoryQueryLabels(["Ceramic Art"]).includes("#Ceramic Art"));
  assert.ok(creatorMatchesBrowseCategories({ categories: ["Ceramic Art"] }, ["mom", "#ceramic art"]));
  assert.equal(creatorMatchesBrowseCategories({ categories: ["carpet"] }, ["car"]), false);
  assert.equal(creatorMatchesBrowseCategories({ categories: ["Gaming"] }, ["mom"]), false);
  assert.deepEqual(expandCategoryQueryLabels(["__uncategorized__"]), ["__uncategorized__"]);
});
