import assert from "node:assert/strict";

import {
  isNonContentCategoryLabel,
  profileHasBeautyEvidence,
  refineStoredDisplayCategories,
} from "@/lib/creators/category-signal-quality";

assert.equal(isNonContentCategoryLabel("Beauty, cosmetic & personal care"), true);
assert.equal(isNonContentCategoryLabel("Digital creator"), true);
assert.equal(isNonContentCategoryLabel("#grwm"), true);
assert.equal(isNonContentCategoryLabel("Fitness"), false);

assert.equal(profileHasBeautyEvidence(["Makeup artist in Cairo"]), true);
assert.equal(profileHasBeautyEvidence(["Fitness coach | Egypt"]), false);
assert.equal(profileHasBeautyEvidence([null, ""]), false);

assert.deepEqual(
  refineStoredDisplayCategories(["Beauty", "Fitness", "Music"], {
    hasBeautyEvidence: false,
    inferredCategories: [],
  }),
  ["Fitness", "Music"]
);

assert.deepEqual(
  refineStoredDisplayCategories(["Beauty"], {
    hasBeautyEvidence: false,
    inferredCategories: [],
  }),
  ["Beauty"],
  "Do not uncategorize a creator whose only stored niche is Beauty"
);

assert.deepEqual(
  refineStoredDisplayCategories(["Beauty", "Digital Creator"], {
    hasBeautyEvidence: false,
    inferredCategories: [],
  }),
  ["Beauty"]
);

console.log("category-signal-quality.test.ts: all assertions passed");
