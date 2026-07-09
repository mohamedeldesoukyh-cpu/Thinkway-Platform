/**
 * Creator category keyword → canonical Discovery label map.
 * Shared by enrichment inference, AI search parsing, and Discovery filters.
 */
export const CREATOR_CATEGORY_KEYWORDS: Readonly<Record<string, string>> = {
  beauty: "Beauty",
  skincare: "Beauty",
  makeup: "Beauty",
  cosmetics: "Beauty",
  grwm: "Beauty",
  cosmetic: "Beauty",
  fashion: "Fashion",
  style: "Fashion",
  outfit: "Fashion",
  ootd: "Fashion",
  fitness: "Fitness",
  workout: "Fitness",
  gym: "Fitness",
  food: "Food",
  foodie: "Food",
  cooking: "Food",
  recipe: "Food",
  recipes: "Food",
  travel: "Travel",
  traveler: "Travel",
  travelling: "Travel",
  lifestyle: "Lifestyle",
  tech: "Tech",
  technology: "Tech",
  gaming: "Gaming",
  gamer: "Gaming",
  esports: "Gaming",
};

/** Canonical Discovery quick-filter category labels. */
export const CREATOR_CATEGORY_LABELS = [
  "Beauty",
  "Fashion",
  "Fitness",
  "Food",
  "Travel",
  "Lifestyle",
  "Tech",
  "Gaming",
] as const;

export type CreatorCategoryLabel = (typeof CREATOR_CATEGORY_LABELS)[number];
