import { CREATOR_CATEGORY_KEYWORDS } from "@/lib/creators/category-keywords";
import { mergeInterestStringArrays } from "@/lib/performance/interest-sync-policy";

export type CategoryInferenceInput = {
  bio?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
  /** Extra terms to scan (e.g. Apify business category, raw interest tags). */
  extraTerms?: string[] | null;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalize a hashtag, mention, or token for keyword lookup. */
export function normalizeCategorySignal(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/^@+/, "")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveKeywordToken(token: string): string | null {
  const normalized = normalizeCategorySignal(token);
  if (!normalized) return null;

  const direct = CREATOR_CATEGORY_KEYWORDS[normalized];
  if (direct) return direct;

  for (const word of normalized.split(/\s+/)) {
    const match = CREATOR_CATEGORY_KEYWORDS[word];
    if (match) return match;
  }

  return null;
}

function addCanonicalCategory(
  categories: string[],
  seen: Set<string>,
  canonical: string
): void {
  const key = canonical.trim().toLowerCase();
  if (!key || seen.has(key)) return;
  seen.add(key);
  categories.push(canonical);
}

/**
 * Infer Thinkway category labels from bio text, hashtags, mentions, and extra terms.
 * Returns canonical labels only (Beauty, Fashion, etc.) — never removes existing data.
 */
export function inferCategoriesFromProfileSignals(
  input: CategoryInferenceInput
): string[] {
  const categories: string[] = [];
  const seen = new Set<string>();

  const scanToken = (token: string) => {
    const canonical = resolveKeywordToken(token);
    if (canonical) addCanonicalCategory(categories, seen, canonical);
  };

  for (const tag of input.hashtags ?? []) {
    scanToken(tag);
  }

  for (const mention of input.mentions ?? []) {
    scanToken(mention);
  }

  for (const term of input.extraTerms ?? []) {
    scanToken(term);
  }

  const bio = input.bio?.trim();
  if (bio) {
    for (const rawTag of bio.match(/#[\w.-]+/g) ?? []) {
      scanToken(rawTag);
    }

    const bioLower = bio.toLowerCase();
    for (const [keyword, canonical] of Object.entries(CREATOR_CATEGORY_KEYWORDS)) {
      if (keyword.length < 3) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
      if (pattern.test(bioLower)) {
        addCanonicalCategory(categories, seen, canonical);
      }
    }
  }

  return categories;
}

/** Append inferred categories to an existing list (deduped, case-insensitive). */
export function mergeInferredCategories(
  existing: string[] | null | undefined,
  inferred: string[] | null | undefined
): string[] {
  return mergeInterestStringArrays(existing, inferred);
}
