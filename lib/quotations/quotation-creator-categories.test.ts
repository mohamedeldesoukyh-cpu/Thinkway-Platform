import assert from "node:assert/strict";

import {
  buildQuotationMainCategoryBreakdown,
  inferNearestMainCategoryFallback,
  mapSubcategoryLabelToMainCategories,
  resolveBestDisplayNameForInference,
  resolveMainCategoriesForCreatorLabels,
  resolveQuotationCreatorDisplayCategories,
} from "@/lib/quotations/quotation-creator-categories";

assert.deepEqual(mapSubcategoryLabelToMainCategories("Sport"), ["Sports"]);
assert.deepEqual(mapSubcategoryLabelToMainCategories("Recipe creator"), ["Food"]);
assert.deepEqual(mapSubcategoryLabelToMainCategories("Housewives"), ["Parenting"]);
assert.deepEqual(mapSubcategoryLabelToMainCategories("Skincare"), ["Beauty"]);
assert.deepEqual(mapSubcategoryLabelToMainCategories("جمال"), ["Beauty"]);
assert.deepEqual(mapSubcategoryLabelToMainCategories("رياضة"), ["Sports"]);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    itemCategories: ["جمال", "مكياج"],
  }),
  ["Beauty"],
  "Arabic item categories should translate to English for display"
);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    creator: {
      browse_category_tags: ["جمال"],
      categories: [],
      ai_category: null,
      ai_niche: null,
      audience_interests: [],
      bio: null,
      hashtags: [],
      mentions: [],
      platforms: [],
      display_name: "Sara",
    },
  }),
  ["Beauty"],
  "Arabic stored browse tags should translate for quotation display"
);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    creator: {
      browse_category_tags: [],
      categories: [],
      ai_category: null,
      ai_niche: null,
      audience_interests: [],
      bio: "محتوى رياضي يومي",
      hashtags: [],
      mentions: [],
      platforms: [],
      display_name: "Ahmed",
    },
  }),
  ["Sports"],
  "Arabic bio should infer Sports for quotation display"
);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    creator: {
      browse_category_tags: [],
      categories: [],
      ai_category: null,
      ai_niche: null,
      audience_interests: [],
      bio: "Beauty tips · نصائح جمال",
      hashtags: ["#beauty", "#جمال"],
      mentions: [],
      platforms: [],
      display_name: "Nour | مكياج",
    },
  }).sort(),
  ["Beauty"],
  "Mixed Arabic/English creator should resolve Beauty"
);

assert.deepEqual(
  resolveMainCategoriesForCreatorLabels(["جمال", "Sports"]),
  ["Beauty", "Sports"],
  "Arabic subcategories should roll up to English main categories"
);

assert.deepEqual(
  resolveMainCategoriesForCreatorLabels(["Beauty", "Skincare", "Sport"]),
  ["Beauty", "Sports"]
);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    creator: {
      browse_category_tags: [],
      categories: [],
      ai_category: null,
      ai_niche: "Fitness",
      audience_interests: [],
      bio: "Personal trainer · workout tips #gym",
      hashtags: ["#fitness"],
      mentions: [],
      platforms: [],
      display_name: "Trainer Joe",
    },
  }),
  ["Fitness"]
);

const drDinaCategories = resolveQuotationCreatorDisplayCategories({
  creator: {
    browse_category_tags: [],
    categories: [],
    ai_category: null,
    ai_niche: null,
    audience_interests: [],
    bio: "Nutritionist. ✨Birth doula. ✨Full time mum.",
    hashtags: [],
    mentions: [],
    platforms: [],
    display_name: "",
  },
  creatorName: "Dr.dina muhamad| Nutritionist 💫 (@dr.dinamuhamad)",
  handle: "dr.dinamuhamad",
});
assert.ok(
  drDinaCategories.includes("Health & Wellness"),
  "Dr. Dina profile should infer Health & Wellness from nutritionist/doula signals"
);
assert.ok(
  drDinaCategories.includes("Parenting"),
  "Dr. Dina profile should infer Parenting from full time mum signal"
);
assert.equal(drDinaCategories.length, 2);

assert.equal(
  resolveBestDisplayNameForInference(
    "Dr.dina muhamad",
    "Dr.dina muhamad| Nutritionist 💫 (@dr.dinamuhamad)"
  ),
  "Dr.dina muhamad| Nutritionist 💫 (@dr.dinamuhamad)",
  "Pipe-rich unified display name should beat stale quotation creator_name"
);

const drDinaStaleLineName = resolveQuotationCreatorDisplayCategories({
  creator: {
    browse_category_tags: [],
    categories: [],
    ai_category: null,
    ai_niche: null,
    audience_interests: [],
    bio: null,
    hashtags: [],
    mentions: [],
    platforms: [
      {
        id: "pa-1",
        platform: "instagram",
        handle: "dr.dinamuhamad",
        profile_url: null,
        follower_count: null,
        engagement_rate: null,
        audience_country: null,
        profile_bio: "Nutritionist. ✨Birth doula. ✨Full time mum.",
      },
    ],
    display_name: "Dr.dina muhamad| Nutritionist 💫 (@dr.dinamuhamad)",
  },
  creatorName: "Dr.dina muhamad",
  handle: "dr.dinamuhamad",
  linePlatform: "instagram",
});
assert.deepEqual(
  drDinaStaleLineName.sort(),
  ["Health & Wellness", "Parenting"],
  "Stale line creator_name + line-platform bio should still infer categories"
);

const drDinaNoCreatorLookup = resolveQuotationCreatorDisplayCategories({
  creatorName: "Dr.dina muhamad| Nutritionist 💫 (@dr.dinamuhamad)",
  handle: "dr.dinamuhamad",
  extraBio: "Nutritionist. ✨Birth doula. ✨Full time mum.",
});
assert.deepEqual(
  drDinaNoCreatorLookup.sort(),
  ["Health & Wellness", "Parenting"],
  "Line-only snapshot should infer when unified lookup is unavailable"
);

assert.deepEqual(
  resolveMainCategoriesForCreatorLabels(drDinaCategories),
  ["Health & Wellness", "Parenting"]
);

assert.deepEqual(
  buildQuotationMainCategoryBreakdown({
    creatorGroups: [{ categories: drDinaCategories }],
    totalCreators: 1,
    formatSharePct: (count, total) => `${((count / total) * 100).toFixed(1)}%`,
  }).map((row) => [row.label, row.count]),
  [
    ["Health & Wellness", 1],
    ["Parenting", 1],
  ],
  "Inferred categories should roll up in unique creator category summary"
);

assert.deepEqual(
  buildQuotationMainCategoryBreakdown({
    creatorGroups: [
      { categories: ["Beauty", "Lifestyle"] },
      { categories: ["Beauty, Sport"] },
    ],
    totalCreators: 2,
    formatSharePct: (count, total) => `${((count / total) * 100).toFixed(1)}%`,
  }).map((row) => [row.label, row.count]),
  [
    ["Beauty", 2],
    ["Lifestyle", 1],
    ["Sports", 1],
  ]
);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    itemCategories: ["General influencer", "Creator"],
    creatorName: "Noura Ahmed",
    handle: "noura.eg",
    linePlatform: "instagram",
  }),
  ["Lifestyle"],
  "Stale non-mapping line tags should fall through to identity fallback"
);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    creatorName: "Noura",
    handle: "noura.eg",
    linePlatform: "instagram",
    followers: 120_000,
    countryCode: "EG",
  }),
  ["Lifestyle"],
  "MENA creator with followers should get Lifestyle when no other signals"
);

assert.equal(
  inferNearestMainCategoryFallback({
    creatorName: "Random Creator",
    handle: "randomcreator",
    linePlatform: "instagram",
  }),
  "Lifestyle",
  "Name + handle alone should never stay uncategorized"
);

assert.deepEqual(
  buildQuotationMainCategoryBreakdown({
    creatorGroups: [
      { categories: resolveQuotationCreatorDisplayCategories({ creatorName: "Noura", handle: "noura.eg", linePlatform: "instagram", followers: 50_000, countryCode: "EG" }) },
      { categories: resolveQuotationCreatorDisplayCategories({ creatorName: "Layla", handle: "layla_kw", linePlatform: "tiktok", followers: 80_000, countryCode: "KW" }) },
    ],
    totalCreators: 2,
    formatSharePct: (count, total) => `${((count / total) * 100).toFixed(1)}%`,
  }).map((row) => row.label),
  ["Lifestyle"],
  "Fallback-assigned creators should not appear as Uncategorized"
);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    creator: {
      browse_category_tags: ["Beauty", "Fitness", "Music", "Travel"],
      categories: ["Beauty", "Fitness", "Music", "Travel"],
      ai_category: "Beauty",
      ai_niche: null,
      audience_interests: ["Beauty", "Fitness", "Music", "Travel"],
      bio: null,
      hashtags: [],
      mentions: [],
      platforms: [],
      display_name: "Ahmed Magdy",
    },
  }),
  ["Fitness", "Music", "Travel"],
  "Imported audience-interest Beauty should not outrank Fitness when the profile has no beauty evidence"
);

assert.deepEqual(
  resolveQuotationCreatorDisplayCategories({
    creator: {
      browse_category_tags: ["Beauty", "Digital Creator"],
      categories: ["Beauty", "Digital Creator"],
      ai_category: "Beauty",
      ai_niche: null,
      audience_interests: [],
      bio: null,
      hashtags: [],
      mentions: [],
      platforms: [],
      display_name: "Engy",
    },
  }),
  ["Beauty"],
  "Instagram account-type labels drop; lone Beauty stays when there is no other niche"
);

console.log("quotation-creator-categories.test.ts passed");
