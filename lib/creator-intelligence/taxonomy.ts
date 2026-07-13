/**
 * Creator Intelligence — canonical taxonomy & normalization façade.
 *
 * ONE place that defines what a canonical category / language / brand-safety
 * level / topic is, and ONE normalizer per attribute. Nothing here invents a
 * new vocabulary: categories reuse the existing CREATOR_CATEGORY_KEYWORDS
 * canonical labels, countries reuse resolveCountryCode, platforms reuse
 * resolveDiscoveryPlatform. Consumers must import normalizers from here rather
 * than re-implementing mapping logic (the platform/country/tier bugs all came
 * from duplicated or missing normalization).
 */
import {
  CREATOR_CATEGORY_KEYWORDS,
  CREATOR_CATEGORY_LABELS,
} from "@/lib/creators/category-keywords";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { resolveDiscoveryPlatform } from "@/lib/social/platforms";

/** Re-exported so the CI layer is a one-stop normalization façade. */
export { resolveCountryCode, resolveDiscoveryPlatform };

// --- categories ---------------------------------------------------------------

/**
 * Canonical category vocabulary = the Discovery quick-filter labels plus every
 * canonical label the keyword map can emit (e.g. "Music", "Comedy" → mapped
 * labels). Derived, never re-declared.
 */
export const CANONICAL_CREATOR_CATEGORIES: readonly string[] = [
  ...new Set<string>([
    ...CREATOR_CATEGORY_LABELS,
    ...Object.values(CREATOR_CATEGORY_KEYWORDS),
  ]),
];

const CATEGORY_BY_LOWER = new Map<string, string>(
  CANONICAL_CREATOR_CATEGORIES.map((label) => [label.toLowerCase(), label])
);

/**
 * Normalize a raw category value to its canonical label, case-insensitively.
 * "lifestyle" / "LIFESTYLE" / "Lifestyle" → "Lifestyle"; keyword aliases map
 * via CREATOR_CATEGORY_KEYWORDS ("comedy" → "Entertainment"). Unknown → null,
 * so callers can distinguish "not a category" from "category".
 */
export function resolveCanonicalCategory(value: string | null | undefined): string | null {
  const key = value?.trim().toLowerCase();
  if (!key) return null;
  return CATEGORY_BY_LOWER.get(key) ?? CREATOR_CATEGORY_KEYWORDS[key] ?? null;
}

/** Normalize a list of raw category values; unknown values drop out; deduped. */
export function resolveCanonicalCategories(
  values: ReadonlyArray<string | null | undefined> | null | undefined
): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const value of values ?? []) {
    const canonical = resolveCanonicalCategory(value);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    resolved.push(canonical);
  }
  return resolved;
}

/** Case-insensitive canonical category match (the ONLY category comparator). */
export function categoriesIntersect(
  a: ReadonlyArray<string> | null | undefined,
  b: ReadonlyArray<string> | null | undefined
): boolean {
  if (!a?.length || !b?.length) return false;
  const left = new Set(resolveCanonicalCategories(a));
  return resolveCanonicalCategories(b).some((category) => left.has(category));
}

// --- languages ------------------------------------------------------------------

/** Common language name/alias → ISO 639-1. Codes pass through lowercased. */
const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  english: "en",
  arabic: "ar",
  french: "fr",
  german: "de",
  spanish: "es",
  italian: "it",
  turkish: "tr",
  hindi: "hi",
  urdu: "ur",
  portuguese: "pt",
  russian: "ru",
  mandarin: "zh",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
};

/** Normalize a language value ("Arabic", "AR", "ar-EG") to ISO 639-1. */
export function resolveLanguageCode(value: string | null | undefined): string | null {
  const key = value?.trim().toLowerCase();
  if (!key) return null;
  const alias = LANGUAGE_ALIASES[key];
  if (alias) return alias;
  const base = key.split(/[-_]/)[0] ?? key;
  return /^[a-z]{2,3}$/.test(base) ? base : null;
}

/** Normalize a list of language values; unknown drop out; deduped. */
export function resolveLanguageCodes(
  values: ReadonlyArray<string | null | undefined> | null | undefined
): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const value of values ?? []) {
    const code = resolveLanguageCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    resolved.push(code);
  }
  return resolved;
}

// --- brand safety ----------------------------------------------------------------

/**
 * Canonical brand-safety scale, ordered safest → riskiest. "unknown" means no
 * signal has been resolved yet — consumers must treat it as unknown, never as
 * safe (unknown-discount scoring, not silent pass).
 */
export const BRAND_SAFETY_LEVELS = ["safe", "low_risk", "moderate_risk", "high_risk", "unknown"] as const;
export type BrandSafetyLevel = (typeof BRAND_SAFETY_LEVELS)[number];

const BRAND_SAFETY_ORDER: Readonly<Record<Exclude<BrandSafetyLevel, "unknown">, number>> = {
  safe: 0,
  low_risk: 1,
  moderate_risk: 2,
  high_risk: 3,
};

/** True when `level` is at least as safe as `minimum` (unknown is never sufficient). */
export function meetsBrandSafetyMinimum(
  level: BrandSafetyLevel,
  minimum: Exclude<BrandSafetyLevel, "unknown">
): boolean {
  if (level === "unknown") return false;
  return BRAND_SAFETY_ORDER[level] <= BRAND_SAFETY_ORDER[minimum];
}

// --- topics ------------------------------------------------------------------------

/**
 * Topics are free-form content themes (hashtags, interests, AI themes) —
 * looser than categories. Normalization: lowercase, strip '#', collapse
 * whitespace/punctuation; short/noise tokens drop out.
 */
export function resolveTopic(value: string | null | undefined): string | null {
  const topic = value
    ?.trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!topic || topic.length < 3) return null;
  return topic;
}

/** Normalize a list of topic values; noise drops out; deduped; capped. */
export function resolveTopics(
  values: ReadonlyArray<string | null | undefined> | null | undefined,
  limit = 24
): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const value of values ?? []) {
    const topic = resolveTopic(value);
    if (!topic || seen.has(topic)) continue;
    seen.add(topic);
    resolved.push(topic);
    if (resolved.length >= limit) break;
  }
  return resolved;
}
