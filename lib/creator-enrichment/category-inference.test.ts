import assert from "node:assert/strict";

import {
  inferCategoriesFromProfileSignals,
  mergeInferredCategories,
  normalizeCategorySignal,
} from "@/lib/creator-enrichment/category-inference";

assert.equal(normalizeCategorySignal("#Beauty"), "beauty");
assert.equal(normalizeCategorySignal("@travel_blogger"), "travel blogger");

assert.deepEqual(
  inferCategoriesFromProfileSignals({
    bio: "Dubai travel & lifestyle creator ✈️",
    hashtags: ["#foodie", "#recipes"],
    mentions: ["@fitness"],
  }),
  ["Food", "Fitness", "Travel", "Lifestyle"]
);

assert.deepEqual(
  inferCategoriesFromProfileSignals({
    bio: "Beauty & skincare routines #grwm",
    hashtags: ["beauty", "skincare"],
    extraTerms: ["Fashion influencer"],
  }),
  ["Beauty", "Fashion"]
);

assert.deepEqual(
  inferCategoriesFromProfileSignals({
    bio: null,
    hashtags: [],
    mentions: [],
  }),
  []
);

assert.deepEqual(
  mergeInferredCategories(["Beauty", "Fashion"], ["beauty", "Travel"]),
  ["Beauty", "Fashion", "Travel"]
);

assert.deepEqual(
  mergeInferredCategories(["Food Pro"], ["Food", "Beauty"]),
  ["Food Pro", "Food", "Beauty"]
);

assert.deepEqual(
  mergeInferredCategories(undefined, ["Gaming"]),
  ["Gaming"]
);

assert.deepEqual(
  mergeInferredCategories(["Beauty"], []),
  ["Beauty"]
);

console.log("category-inference.test.ts: all assertions passed");
