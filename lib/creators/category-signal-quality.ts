/**
 * Weak / non-content category signals that should not stamp a creator as Beauty
 * (or another niche). Instagram page categories, format hashtags, and imported
 * Facebook audience-interest dumps are the usual sources.
 */

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/^@+/, "")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Instagram / Facebook professional page categories — account type, not niche. */
const NON_CONTENT_CATEGORY_PHRASES = [
  "digital creator",
  "public figure",
  "personal blog",
  "video creator",
  "entrepreneur",
  "artist",
  "musician band",
  "blogger",
  "community",
  "product service",
  "health beauty",
  "beauty cosmetic personal care",
  "grwm",
  "get ready with me",
  "fyp",
  "foryou",
  "foryoupage",
  "viral",
] as const;

const NON_CONTENT_CATEGORY_SET = new Set(NON_CONTENT_CATEGORY_PHRASES);

/** Specific beauty evidence — not the generic Facebook interest bucket "Beauty". */
const BEAUTY_EVIDENCE_RE =
  /\b(skincare|makeup|make-up|cosmetics?|مكياج|تجميل|ميكاب|ميكب|سكينكير)\b/i;

const BEAUTY_LABEL_RE = /^(beauty|skincare|makeup|make-up|cosmetics?)$/i;

export function isNonContentCategoryLabel(value: string | null | undefined): boolean {
  const normalized = normalizeLabel(value ?? "");
  return Boolean(normalized) && NON_CONTENT_CATEGORY_SET.has(normalized);
}

export function isGenericBeautyCategoryLabel(value: string): boolean {
  return BEAUTY_LABEL_RE.test(value.trim());
}

/** True when bio / hashtags / name actually talk about beauty work. */
export function profileHasBeautyEvidence(parts: Array<string | null | undefined>): boolean {
  const text = parts
    .flatMap((part) => (part ?? "").split(/[#@,\n|]+/))
    .join(" ")
    .trim();
  if (!text) return false;
  if (BEAUTY_EVIDENCE_RE.test(text)) return true;
  // English "beauty" in the profile itself (not a stored audience-interest tag).
  return /\bbeauty\b/i.test(text);
}

/**
 * Drop Instagram account-type labels and uncorroborated generic Beauty tags
 * when the creator already has another content category (e.g. Fitness).
 * Keep Beauty when it is the only niche or the profile corroborates it.
 */
export function refineStoredDisplayCategories(
  stored: string[],
  options: {
    hasBeautyEvidence: boolean;
    inferredCategories?: string[];
  }
): string[] {
  const withoutAccountTypes = stored.filter((tag) => !isNonContentCategoryLabel(tag));
  if (withoutAccountTypes.length === 0) return [];

  const inferredOther = (options.inferredCategories ?? []).filter(
    (tag) => !isGenericBeautyCategoryLabel(tag)
  );
  const storedOther = withoutAccountTypes.filter((tag) => !isGenericBeautyCategoryLabel(tag));
  const keepGenericBeauty =
    options.hasBeautyEvidence ||
    (storedOther.length === 0 && inferredOther.length === 0);

  if (keepGenericBeauty) return withoutAccountTypes;

  return withoutAccountTypes.filter((tag) => !isGenericBeautyCategoryLabel(tag));
}
