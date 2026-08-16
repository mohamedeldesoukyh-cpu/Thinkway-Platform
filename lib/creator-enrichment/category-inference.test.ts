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
  inferCategoriesFromProfileSignals({
    displayName: "Dr.dina muhamad| Nutritionist 💫 (@dr.dinamuhamad)",
    handle: "dr.dinamuhamad",
    bio: "Nutritionist. ✨Birth doula. ✨Full time mum.",
    hashtags: [],
    mentions: [],
  }).sort(),
  ["Health & Wellness", "Parenting"]
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

assert.deepEqual(
  inferCategoriesFromProfileSignals({
    extraTerms: ["جمال"],
  }),
  ["Beauty"],
  "Arabic category tag جمال should map to Beauty"
);

assert.deepEqual(
  inferCategoriesFromProfileSignals({
    handle: "abeer_kittchen",
    displayName: "Abeer Kitchen",
  }),
  ["Food"]
);

assert.deepEqual(
  inferCategoriesFromProfileSignals({
    bio: "صانعة محتوى رياضي · نصائح يومية للياقة",
    hashtags: [],
    mentions: [],
  }).sort(),
  ["Fitness", "Sports"],
  "Arabic bio with رياضة and لياقة should infer Sports and Fitness"
);

assert.deepEqual(
  inferCategoriesFromProfileSignals({
    bio: "Beauty & جمال content · #مكياج tutorials",
    hashtags: ["#مكياج"],
    extraTerms: ["Fashion", "موضة"],
  }).sort(),
  ["Beauty", "Fashion"],
  "Mixed Arabic/English profile should resolve both languages"
);

console.log("category-inference.test.ts: all assertions passed");
