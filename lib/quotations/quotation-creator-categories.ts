/**
 * Quotation export — creator category resolution and main-category summary grouping.
 *
 * Display chips keep stored subcategory tags (max 3). The "Creators by Category"
 * summary rolls subcategories up to main categories and counts each creator once
 * per main category (multi-category creators can appear under multiple mains).
 *
 * DNA fallback (when no stored tags): ai_category, ai_niche, audience_interests,
 * platform metadata categories, bio/hashtags/mentions via keyword inference.
 */
import {
  inferCategoriesFromProfileSignals,
  mergeInferredCategories,
} from "@/lib/creator-enrichment/category-inference";
import {
  containsArabicScript,
  inferCategoriesFromArabicText,
  resolveArabicCategoryToken,
  translateArabicCategoryLabel,
} from "@/lib/creators/arabic-category-keywords";
import {
  CREATOR_CATEGORY_KEYWORDS,
  CREATOR_CATEGORY_LABELS,
} from "@/lib/creators/category-keywords";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  creatorStoredCategoriesForDisplay,
  normalizeCategoryList,
} from "@/lib/creators/category-filter";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

/** Main categories used in quotation export summaries (Tuna/Dolphin + Discovery aligned). */
export const QUOTATION_MAIN_CREATOR_CATEGORIES = [
  ...CREATOR_CATEGORY_LABELS,
] as const;

export type QuotationMainCreatorCategory = (typeof QUOTATION_MAIN_CREATOR_CATEGORIES)[number];

const MAIN_CATEGORY_LOOKUP = new Map(
  QUOTATION_MAIN_CREATOR_CATEGORIES.map((label) => [label.toLowerCase(), label])
);

/**
 * Explicit subcategory / import-tag → main category aliases (case-insensitive keys).
 * Supplements CREATOR_CATEGORY_KEYWORDS for labels like "Food Pro" or "Recipe creator".
 */
const SUBCATEGORY_MAIN_ALIASES: Readonly<Record<string, QuotationMainCreatorCategory>> = {
  "food pro": "Food",
  "food & beverage": "Food",
  "restaurants, food & grocery": "Food",
  "recipe creator": "Food",
  "recipe": "Food",
  "recipes": "Food",
  "cooking": "Food",
  "foodie": "Food",
  "sport": "Sports",
  "sports": "Sports",
  "athlete": "Sports",
  "running": "Sports",
  "housewives": "Parenting",
  "housewife": "Parenting",
  "mom life": "Parenting",
  "mom": "Parenting",
  "motherhood": "Parenting",
  "parenting": "Parenting",
  "family": "Parenting",
  "parent life": "Parenting",
  "maternity": "Parenting",
  "pregnancy": "Parenting",
  "kids": "Parenting",
  "baby": "Parenting",
  "skincare": "Beauty",
  "makeup": "Beauty",
  "cosmetics": "Beauty",
  "beauty & cosmetics": "Beauty",
  "grwm": "Beauty",
  "comedy": "Entertainment",
  "entertainment": "Entertainment",
  "camera & photography": "Lifestyle",
  "luxury lifestyle": "Lifestyle",
  "health & wellness": "Health & Wellness",
  "wellness": "Health & Wellness",
  nutritionist: "Health & Wellness",
  nutrition: "Health & Wellness",
  dietitian: "Health & Wellness",
  dietician: "Health & Wellness",
  doula: "Health & Wellness",
  "birth doula": "Health & Wellness",
  midwife: "Health & Wellness",
  pharmacist: "Health & Wellness",
  therapist: "Health & Wellness",
  doctor: "Health & Wellness",
  physician: "Health & Wellness",
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
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isMainCategoryLabel(label: string): label is QuotationMainCreatorCategory {
  return MAIN_CATEGORY_LOOKUP.has(normalizeToken(label));
}

function canonicalMainCategory(label: string): QuotationMainCreatorCategory | null {
  const normalized = normalizeToken(label);
  return MAIN_CATEGORY_LOOKUP.get(normalized) ?? null;
}

function platformMetadataCategoryTerms(
  platforms: UnifiedCreatorResult["platforms"] | undefined
): string[] {
  const terms: string[] = [];
  for (const account of platforms ?? []) {
    const metadata = account.metadata as Record<string, unknown> | null | undefined;
    if (!metadata) continue;
    for (const key of ["business_category", "category", "niche", "interest_categories"]) {
      const value = metadata[key];
      if (typeof value === "string" && value.trim()) {
        terms.push(value.trim());
      } else if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === "string" && entry.trim()) terms.push(entry.trim());
        }
      }
    }
  }
  return terms;
}

/** Split comma-joined category strings into distinct labels. */
export function normalizedQuotationCategoryLabels(
  categories: string[] | null | undefined
): string[] {
  const labels = new Set<string>();
  for (const category of categories ?? []) {
    category
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => labels.add(value));
  }
  return [...labels];
}

/** Translate Arabic category labels to English canonical forms when possible. */
export function translateQuotationCategoryLabels(
  labels: string[] | null | undefined
): string[] {
  const translated = new Set<string>();
  for (const label of normalizedQuotationCategoryLabels(labels)) {
    if (containsArabicScript(label)) {
      const direct = translateArabicCategoryLabel(label);
      if (!containsArabicScript(direct)) {
        translated.add(direct);
        continue;
      }
      for (const inferred of inferCategoriesFromArabicText(label)) {
        translated.add(inferred);
      }
      continue;
    }
    translated.add(label);
  }
  return [...translated];
}

/** Collect DNA / AI / platform signals for category inference. */
export function quotationCreatorCategorySignals(
  creator: Pick<
    UnifiedCreatorResult,
    | "ai_category"
    | "ai_niche"
    | "audience_interests"
    | "categories"
    | "browse_category_tags"
    | "bio"
    | "hashtags"
    | "mentions"
    | "platforms"
    | "display_name"
  >,
  profile?: {
    creatorName?: string | null;
    handle?: string | null;
  }
): string[] {
  const platformHandle =
    creator.platforms?.find((account) => account.handle?.trim())?.handle ?? null;

  return [
    creator.ai_category,
    creator.ai_niche,
    ...(creator.audience_interests ?? []),
    ...(creator.categories ?? []),
    ...(creator.browse_category_tags ?? []),
    ...platformMetadataCategoryTerms(creator.platforms),
    profile?.creatorName,
    profile?.handle,
    creator.display_name,
    platformHandle,
  ].filter((value): value is string => Boolean(value?.trim()));
}

/** Prefer the richest display name for role/handle inference (pipe segments, OG titles). */
export function resolveBestDisplayNameForInference(
  creatorName?: string | null,
  creatorDisplayName?: string | null
): string | null {
  const candidates = [creatorName, creatorDisplayName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (candidates.length === 0) return null;

  const withPipeRole = candidates.find((name) => name.includes("|"));
  if (withPipeRole) return withPipeRole;

  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

function resolveProfileIdentityForInference(input: {
  creator?: Pick<UnifiedCreatorResult, "display_name" | "platforms"> | null;
  creatorName?: string | null;
  handle?: string | null;
}): { displayName: string | null; handle: string | null } {
  const platformHandle =
    input.creator?.platforms?.find((account) => account.handle?.trim())?.handle ?? null;

  return {
    displayName: resolveBestDisplayNameForInference(
      input.creatorName,
      input.creator?.display_name
    ),
    handle: input.handle?.trim() || platformHandle?.trim() || null,
  };
}

function collectCreatorProfileBios(input: {
  creator?: Pick<UnifiedCreatorResult, "bio" | "platforms"> | null;
  linePlatform?: string | null;
  extraBio?: string | null;
}): string | null {
  const bios: string[] = [];
  const seen = new Set<string>();

  const addBio = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    bios.push(trimmed);
  };

  const linePlatform = input.linePlatform
    ? canonicalPlatformKey(input.linePlatform)
    : null;
  if (linePlatform) {
    const lineAccount = input.creator?.platforms?.find(
      (account) => canonicalPlatformKey(account.platform) === linePlatform
    );
    addBio(lineAccount?.profile_bio);
  }

  addBio(input.extraBio);
  addBio(input.creator?.bio);

  for (const account of input.creator?.platforms ?? []) {
    addBio(account.profile_bio);
  }

  return bios.length > 0 ? bios.join(" · ") : null;
}

function storedCategoriesMapToMain(categories: string[]): boolean {
  return resolveMainCategoriesForCreatorLabels(categories).length > 0;
}

/** MENA country codes — broad default to Lifestyle when signals are thin. */
const MENA_COUNTRY_CODES = new Set([
  "ae",
  "bh",
  "dz",
  "eg",
  "iq",
  "jo",
  "kw",
  "lb",
  "ly",
  "ma",
  "om",
  "ps",
  "qa",
  "sa",
  "sd",
  "sy",
  "tn",
  "ye",
]);

function hasAnyCategoryInferenceSignal(input: {
  profileIdentity: { displayName: string | null; handle: string | null };
  profileBio: string | null;
  linePlatform?: string | null;
  followers?: number | null;
}): boolean {
  return Boolean(
    input.profileIdentity.displayName ||
      input.profileIdentity.handle ||
      input.profileBio ||
      input.linePlatform?.trim() ||
      (input.followers != null && input.followers > 0)
  );
}

/**
 * Last-resort main category when the full pipeline returns nothing.
 * Never leaves creators with name/handle/bio/platform uncategorized.
 */
export function inferNearestMainCategoryFallback(input: {
  creatorName?: string | null;
  handle?: string | null;
  creator?: Pick<UnifiedCreatorResult, "display_name" | "bio" | "platforms"> | null;
  linePlatform?: string | null;
  extraBio?: string | null;
  followers?: number | null;
  countryCode?: string | null;
}): QuotationMainCreatorCategory | null {
  const profileIdentity = resolveProfileIdentityForInference(input);
  const profileBio = collectCreatorProfileBios({
    creator: input.creator,
    linePlatform: input.linePlatform,
    extraBio: input.extraBio,
  });

  const aggressive = inferCategoriesFromProfileSignals({
    displayName: profileIdentity.displayName,
    handle: profileIdentity.handle,
    bio: profileBio,
  });
  const aggressiveMains = aggressive
    .map((value) => canonicalMainCategory(value))
    .filter((value): value is QuotationMainCreatorCategory => value != null);
  if (aggressiveMains.length > 0) return aggressiveMains[0]!;

  const identityTerms = [
    profileIdentity.displayName,
    profileIdentity.handle,
    profileBio,
    input.linePlatform,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const term of identityTerms) {
    const mapped = mapSubcategoryLabelToMainCategories(term);
    if (mapped.length > 0) return mapped[0]!;
  }

  const country = input.countryCode?.trim().toLowerCase();
  const hasFollowers = input.followers != null && input.followers > 0;
  if (hasFollowers && country && MENA_COUNTRY_CODES.has(country)) {
    return "Lifestyle";
  }

  if (hasAnyCategoryInferenceSignal({ profileIdentity, profileBio, linePlatform: input.linePlatform, followers: input.followers })) {
    return "Lifestyle";
  }

  return null;
}

/** True when resolved display categories roll up to at least one main category. */
export function quotationCreatorCategoriesMapToMain(
  categories: string[] | null | undefined
): boolean {
  return storedCategoriesMapToMain(normalizedQuotationCategoryLabels(categories));
}

/**
 * Resolve display categories for a quotation line (max 3).
 * Priority: persisted line tags → stored creator tags → DNA/AI inference.
 */
export function resolveQuotationCreatorDisplayCategories(input: {
  itemCategories?: string[] | null;
  creator?: Pick<
    UnifiedCreatorResult,
    | "browse_category_tags"
    | "categories"
    | "ai_category"
    | "ai_niche"
    | "audience_interests"
    | "bio"
    | "hashtags"
    | "mentions"
    | "platforms"
    | "display_name"
  > | null;
  creatorName?: string | null;
  handle?: string | null;
  /** Quotation line platform — prefer that account's bio for inference. */
  linePlatform?: string | null;
  /** Extra bio text from line snapshots when unified lookup is partial. */
  extraBio?: string | null;
  followers?: number | null;
  countryCode?: string | null;
}): string[] {
  const profileIdentity = resolveProfileIdentityForInference(input);
  const profileBio = collectCreatorProfileBios({
    creator: input.creator,
    linePlatform: input.linePlatform,
    extraBio: input.extraBio,
  });

  const fromItem = translateQuotationCategoryLabels(
    normalizedQuotationCategoryLabels(input.itemCategories)
  );
  if (fromItem.length > 0 && storedCategoriesMapToMain(fromItem)) {
    return fromItem.slice(0, 3);
  }

  if (!input.creator) {
    const inferredFromProfile = inferCategoriesFromProfileSignals({
      displayName: profileIdentity.displayName,
      handle: profileIdentity.handle,
      bio: profileBio,
      extraTerms: fromItem.length > 0 ? fromItem : undefined,
    });
    const merged = mergeInferredCategories(
      storedCategoriesMapToMain(fromItem) ? fromItem : [],
      inferredFromProfile
    );
    if (merged.length > 0) {
      const withMains = resolveMainCategoriesForCreatorLabels(merged);
      if (withMains.length > 0) return merged.slice(0, 3);
    }

    const fallback = inferNearestMainCategoryFallback(input);
    return fallback ? [fallback] : [];
  }

  const stored = translateQuotationCategoryLabels(creatorStoredCategoriesForDisplay(input.creator));
  if (stored.length > 0 && storedCategoriesMapToMain(stored)) {
    return stored.slice(0, 3);
  }

  const linePlatform = input.linePlatform
    ? canonicalPlatformKey(input.linePlatform)
    : null;
  const lineAccount =
    linePlatform != null
      ? input.creator.platforms?.find(
          (account) => canonicalPlatformKey(account.platform) === linePlatform
        )
      : null;

  const extraTerms = quotationCreatorCategorySignals(input.creator, {
    creatorName: input.creatorName,
    handle: input.handle,
  });
  const inferred = inferCategoriesFromProfileSignals({
    bio: profileBio,
    hashtags: lineAccount?.hashtags ?? input.creator.hashtags,
    mentions: lineAccount?.mentions ?? input.creator.mentions,
    extraTerms,
    displayName: profileIdentity.displayName,
    handle: profileIdentity.handle,
  });

  const merged = mergeInferredCategories(
    fromItem.length > 0 ? fromItem : stored,
    inferred
  );
  if (merged.length > 0) {
    const withMains = resolveMainCategoriesForCreatorLabels(merged);
    if (withMains.length > 0) return merged.slice(0, 3);
  }

  const directMain = extraTerms
    .map((term) => mapSubcategoryLabelToMainCategories(term))
    .flat();
  const uniqueDirect = [...new Set(directMain)];
  if (uniqueDirect.length > 0) return uniqueDirect.slice(0, 3);

  const fallback = inferNearestMainCategoryFallback(input);
  return fallback ? [fallback] : [];
}

function resolveKeywordMainCategory(token: string): QuotationMainCreatorCategory | null {
  const normalized = normalizeToken(token);
  if (!normalized) return null;

  const direct = CREATOR_CATEGORY_KEYWORDS[normalized];
  if (direct && isMainCategoryLabel(direct)) return direct;

  for (const word of normalized.split(/\s+/)) {
    const match = CREATOR_CATEGORY_KEYWORDS[word];
    if (match && isMainCategoryLabel(match)) return match;
  }

  return null;
}

/** Map one subcategory label to one or more main categories. */
export function mapSubcategoryLabelToMainCategories(label: string): QuotationMainCreatorCategory[] {
  const trimmed = label.trim();
  if (!trimmed) return [];

  if (containsArabicScript(trimmed)) {
    const arabicDirect = resolveArabicCategoryToken(trimmed);
    if (arabicDirect) return [arabicDirect];

    const fromArabicText = inferCategoriesFromArabicText(trimmed);
    if (fromArabicText.length > 0) return [...new Set(fromArabicText)];
  }

  const asMain = canonicalMainCategory(trimmed);
  if (asMain) return [asMain];

  const normalized = normalizeToken(trimmed);
  const alias = SUBCATEGORY_MAIN_ALIASES[normalized];
  if (alias) return [alias];

  for (const [key, main] of Object.entries(SUBCATEGORY_MAIN_ALIASES)) {
    if (normalized === key || normalized.includes(key)) {
      return [main];
    }
  }

  const fromKeyword = resolveKeywordMainCategory(trimmed);
  if (fromKeyword) return [fromKeyword];

  const inferred = inferCategoriesFromProfileSignals({ extraTerms: [trimmed] });
  const mains = inferred
    .map((value) => canonicalMainCategory(value))
    .filter((value): value is QuotationMainCreatorCategory => value != null);
  if (mains.length > 0) return [...new Set(mains)];

  return [];
}

/** Unique main categories for a creator from their display/subcategory labels. */
export function resolveMainCategoriesForCreatorLabels(
  labels: string[] | null | undefined
): QuotationMainCreatorCategory[] {
  const normalized = normalizedQuotationCategoryLabels(labels);
  const mains = new Set<QuotationMainCreatorCategory>();

  for (const label of normalized) {
    for (const main of mapSubcategoryLabelToMainCategories(label)) {
      mains.add(main);
    }
  }

  return [...mains];
}

/** Sorted main categories for one creator from merged display/subcategory labels. */
export function resolveQuotationCreatorMainCategories(
  mergedDisplayLabels: string[] | null | undefined
): QuotationMainCreatorCategory[] {
  return resolveMainCategoriesForCreatorLabels(mergedDisplayLabels).sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Comma-separated main categories for quotation export tables (tier rows, etc.). */
export function formatQuotationMainCategoryLabels(
  mains: QuotationMainCreatorCategory[]
): string {
  return mains.length > 0 ? mains.join(", ") : "Uncategorized";
}

export type QuotationCategoryBreakdownRow = {
  label: string;
  count: number;
  sharePct: string;
};

/** Build main-category breakdown — one count per unique creator per main category. */
export function buildQuotationMainCategoryBreakdown(input: {
  creatorGroups: Array<{ categories: string[] }>;
  totalCreators: number;
  formatSharePct: (count: number, total: number) => string;
}): QuotationCategoryBreakdownRow[] {
  const counts = new Map<string, number>();

  for (const group of input.creatorGroups) {
    const mainCategories = resolveQuotationCreatorMainCategories(group.categories);

    if (mainCategories.length === 0) {
      counts.set("Uncategorized", (counts.get("Uncategorized") ?? 0) + 1);
      continue;
    }

    for (const main of mainCategories) {
      counts.set(main, (counts.get(main) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      sharePct: input.formatSharePct(count, input.totalCreators),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
