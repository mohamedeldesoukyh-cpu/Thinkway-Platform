import { inferCategoriesFromProfileSignals } from "@/lib/creator-enrichment/category-inference";
import {
  categoriesIntersect,
  resolveCanonicalCategories,
} from "@/lib/creator-intelligence/taxonomy";

/**
 * Specialist verticals. Lifestyle on a mass Sports/Entertainment mix must not
 * pull in Food/Beauty/etc. creators who only share a generic Lifestyle tag
 * (or a kitchen/food handle).
 */
export const SPECIALIST_CREATOR_VERTICALS = [
  "Food",
  "Beauty",
  "Fashion",
  "Fitness",
  "Travel",
  "Gaming",
  "Parenting",
  "Automotive",
  "Health & Wellness",
  "Tech",
] as const;

export type StudioCreatorCategoryInput = {
  categories?: ReadonlyArray<string | null | undefined> | null;
  audienceSummary?: string | null;
  handle?: string | null;
  displayName?: string | null;
};

function extraTermsFrom(input: StudioCreatorCategoryInput): string[] {
  const terms = [...(input.categories ?? [])];
  if (input.audienceSummary?.trim()) {
    terms.push(...input.audienceSummary.split(/[,/·|]/));
  }
  return terms.map((value) => value?.trim() ?? "").filter(Boolean);
}

/** Canonical creator categories, including handle/name inference (kitchen → Food). */
export function resolveStudioCreatorCategories(input: StudioCreatorCategoryInput): string[] {
  const inferred = inferCategoriesFromProfileSignals({
    handle: input.handle,
    displayName: input.displayName,
    extraTerms: extraTermsFrom(input),
  });
  return resolveCanonicalCategories([...(input.categories ?? []), ...inferred]);
}

/**
 * True when the creator's mix overlaps preferred Discovery categories, without
 * counting Lifestyle as a match for an unrequested specialist vertical.
 */
export function creatorFitsPreferredCategories(
  input: StudioCreatorCategoryInput,
  preferredCategories: string[]
): boolean {
  const preferred = resolveCanonicalCategories(preferredCategories);
  const creator = resolveStudioCreatorCategories(input);
  if (preferred.length === 0 || creator.length === 0) return false;

  const unrequestedSpecialists = creator.filter(
    (category) =>
      (SPECIALIST_CREATOR_VERTICALS as readonly string[]).includes(category) &&
      !preferred.includes(category)
  );
  const matchable =
    unrequestedSpecialists.length > 0
      ? creator.filter(
          (category) => category !== "Lifestyle" && !unrequestedSpecialists.includes(category)
        )
      : creator;

  return categoriesIntersect(matchable, preferred);
}
