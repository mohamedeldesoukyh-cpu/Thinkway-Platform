/**
 * Creator category keyword → canonical Discovery label map.
 * Shared by enrichment inference, AI search parsing, and Discovery filters.
 */
export const CREATOR_CATEGORY_KEYWORDS: Readonly<Record<string, string>> = {
  beauty: "Beauty",
  skincare: "Beauty",
  makeup: "Beauty",
  cosmetics: "Beauty",
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
  cook: "Food",
  chef: "Food",
  kitchen: "Food",
  kittchen: "Food",
  recipe: "Food",
  recipes: "Food",
  travel: "Travel",
  traveler: "Travel",
  travelling: "Travel",
  lifestyle: "Lifestyle",
  "off road": "Automotive",
  offroad: "Automotive",
  "off-road": "Automotive",
  automotive: "Automotive",
  motorsport: "Automotive",
  motorsports: "Automotive",
  "4x4": "Automotive",
  car: "Automotive",
  cars: "Automotive",
  tech: "Tech",
  technology: "Tech",
  gaming: "Gaming",
  gamer: "Gaming",
  esports: "Gaming",
  sport: "Sports",
  sports: "Sports",
  athlete: "Sports",
  athletic: "Sports",
  football: "Sports",
  soccer: "Sports",
  basketball: "Sports",
  running: "Sports",
  marathon: "Sports",
  mom: "Parenting",
  motherhood: "Parenting",
  parenting: "Parenting",
  maternity: "Parenting",
  pregnancy: "Parenting",
  housewife: "Parenting",
  housewives: "Parenting",
  family: "Parenting",
  kids: "Parenting",
  baby: "Parenting",
  comedy: "Entertainment",
  comedian: "Entertainment",
  humor: "Entertainment",
  wellness: "Health & Wellness",
  health: "Health & Wellness",
  yoga: "Health & Wellness",
  meditation: "Health & Wellness",
  nutritionist: "Health & Wellness",
  nutrition: "Health & Wellness",
  dietitian: "Health & Wellness",
  dietician: "Health & Wellness",
  doula: "Health & Wellness",
  midwife: "Health & Wellness",
  pharmacist: "Health & Wellness",
  therapist: "Health & Wellness",
  doctor: "Health & Wellness",
  physician: "Health & Wellness",
  "birth doula": "Health & Wellness",
  "health coach": "Health & Wellness",
  mum: "Parenting",
  mummy: "Parenting",
  "full time mum": "Parenting",
  "full time mom": "Parenting",
  "full-time mum": "Parenting",
  "full-time mom": "Parenting",
  sahm: "Parenting",
  "stay at home mom": "Parenting",
  "stay at home mum": "Parenting",
  pr: "PR",
  "pr page": "PR",
  "public relations": "PR",
};

/** Canonical tag for PR / press pages — toggled from Discovery pack checkbox. */
export const CREATOR_PR_CATEGORY = "PR" as const;

/** Canonical Discovery quick-filter category labels. */
export const CREATOR_CATEGORY_LABELS = [
  "Beauty",
  "Fashion",
  "Fitness",
  "Food",
  "Travel",
  "Lifestyle",
  "Automotive",
  "Tech",
  "Gaming",
  "Sports",
  "Parenting",
  "Health & Wellness",
  "Entertainment",
  "PR",
] as const;

export type CreatorCategoryLabel = (typeof CREATOR_CATEGORY_LABELS)[number];

/** True when stored categories include the canonical PR tag (case-insensitive). */
export function creatorHasPrCategory(
  categories: ReadonlyArray<string> | null | undefined
): boolean {
  return (categories ?? []).some(
    (tag) => tag.trim().toLowerCase() === CREATOR_PR_CATEGORY.toLowerCase()
  );
}

/** Add or remove the canonical PR tag without replacing other categories. */
export function withPrCategoryToggled(
  categories: ReadonlyArray<string> | null | undefined,
  enabled: boolean
): string[] {
  const next = (categories ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => tag.toLowerCase() !== CREATOR_PR_CATEGORY.toLowerCase());
  // Front-load PR so Discovery's 3-chip Category column keeps it visible.
  if (enabled) next.unshift(CREATOR_PR_CATEGORY);
  return next;
}
