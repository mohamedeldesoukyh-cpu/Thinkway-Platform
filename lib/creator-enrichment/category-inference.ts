import {
  arabicCategoryEnglishFallbackTokens,
  containsArabicScript,
  inferCategoriesFromArabicText,
  resolveArabicCategoryToken,
} from "@/lib/creators/arabic-category-keywords";
import { CREATOR_CATEGORY_KEYWORDS } from "@/lib/creators/category-keywords";
import { isNonContentCategoryLabel } from "@/lib/creators/category-signal-quality";
import { mergeInterestStringArrays } from "@/lib/performance/interest-sync-policy";

export type CategoryInferenceInput = {
  bio?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
  /** Extra terms to scan (e.g. Apify business category, raw interest tags). */
  extraTerms?: string[] | null;
  /** Creator display name — pipe segments (`Name | Role`) and inline role hints. */
  displayName?: string | null;
  /** Platform handle / username (with or without @). */
  handle?: string | null;
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
  if (containsArabicScript(token)) {
    const arabic = resolveArabicCategoryToken(token);
    if (arabic) return arabic;
  }

  const normalized = normalizeCategorySignal(token);
  if (!normalized) return null;
  if (isNonContentCategoryLabel(normalized)) return null;

  const direct = CREATOR_CATEGORY_KEYWORDS[normalized];
  if (direct) return direct;

  for (const word of normalized.split(/\s+/)) {
    const match = CREATOR_CATEGORY_KEYWORDS[word];
    if (match) return match;
  }

  return null;
}

function scanArabicText(text: string, scanCategory: (canonical: string) => void): void {
  for (const canonical of inferCategoriesFromArabicText(text)) {
    scanCategory(canonical);
  }
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

/** Role segments after `|` in display names, e.g. `Dr. Dina | Nutritionist (@handle)`. */
export function extractPipeRoleSegments(displayName: string): string[] {
  const parts = displayName.split("|");
  if (parts.length < 2) return [];

  return parts
    .slice(1)
    .map((segment) =>
      segment
        .replace(/\(@[\w.]+\)/g, "")
        .replace(/[^\p{L}\p{N}\s&.-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

/** Split handles into scannable tokens (`dr.dinamuhamad` → dinamuhamad, etc.). */
export function decomposeHandleTokens(handle: string): string[] {
  const clean = handle.replace(/^@+/, "").trim();
  if (!clean) return [];

  const tokens = new Set<string>([clean]);
  for (const part of clean.split(/[._-]+/)) {
    const normalized = part.trim();
    if (normalized.length >= 3) tokens.add(normalized);
  }
  return [...tokens];
}

/** Collect display-name / handle terms for category keyword inference. */
export function extractProfileIdentityTerms(input: {
  displayName?: string | null;
  handle?: string | null;
}): string[] {
  const terms: string[] = [];

  const displayName = input.displayName?.trim();
  if (displayName) {
    terms.push(...extractPipeRoleSegments(displayName));
    terms.push(displayName);

    const embeddedHandle = displayName.match(/\(@([\w.]+)\)/)?.[1];
    if (embeddedHandle) terms.push(...decomposeHandleTokens(embeddedHandle));
  }

  const handle = input.handle?.trim();
  if (handle) {
    terms.push(...decomposeHandleTokens(handle));
  }

  return terms;
}

function scanBioPhrases(bioLower: string, scanToken: (token: string) => void): void {
  for (const keyword of Object.keys(CREATOR_CATEGORY_KEYWORDS)) {
    if (!keyword.includes(" ")) continue;
    if (bioLower.includes(keyword)) scanToken(keyword);
  }
}

function scanBioKeywords(bioLower: string, scanToken: (token: string) => void): void {
  for (const [keyword] of Object.entries(CREATOR_CATEGORY_KEYWORDS)) {
    if (keyword.length < 3) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
    if (pattern.test(bioLower)) scanToken(keyword);
  }
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

    if (containsArabicScript(token)) {
      for (const fallback of arabicCategoryEnglishFallbackTokens(token)) {
        const fromFallback = resolveKeywordToken(fallback);
        if (fromFallback) addCanonicalCategory(categories, seen, fromFallback);
      }
    }
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

  for (const term of extractProfileIdentityTerms({
    displayName: input.displayName,
    handle: input.handle,
  })) {
    scanToken(term);
  }

  const bio = input.bio?.trim();
  if (bio) {
    for (const rawTag of bio.match(/#[\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF.-]+/gu) ?? []) {
      scanToken(rawTag);
    }

    scanArabicText(bio, (canonical) => addCanonicalCategory(categories, seen, canonical));

    const bioLower = bio.toLowerCase();
    scanBioPhrases(bioLower, scanToken);
    scanBioKeywords(bioLower, scanToken);

    for (const phrase of bio.split(/[.·✨|]+/)) {
      const trimmed = phrase.trim();
      if (trimmed) scanToken(trimmed);
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
