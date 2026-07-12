import type { CreatorCategoryLabel } from "@/lib/creators/category-keywords";

/** Arabic script blocks used in MENA creator profiles (letters + extended Arabic). */
export const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

/** Arabic diacritics (tashkeel) and tatweel to strip before matching. */
const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g;

/**
 * Arabic term → canonical Discovery / quotation main category.
 * Keys sorted longest-first at runtime for phrase matching.
 */
export const ARABIC_CATEGORY_KEYWORDS: Readonly<Record<string, CreatorCategoryLabel>> = {
  // Beauty
  "ميك اب": "Beauty",
  ميكاب: "Beauty",
  مكياج: "Beauty",
  تجميل: "Beauty",
  عناية: "Beauty",
  عنايه: "Beauty",
  بشرة: "Beauty",
  جمال: "Beauty",
  ماسكات: "Beauty",
  ماسك: "Beauty",
  سكينكير: "Beauty",

  // Fashion
  "لايف ستايل": "Lifestyle",
  موضة: "Fashion",
  موضه: "Fashion",
  أزياء: "Fashion",
  ازياء: "Fashion",
  فاشن: "Fashion",
  ستايل: "Fashion",
  ملابس: "Fashion",

  // Fitness
  لياقة: "Fitness",
  لياقه: "Fitness",
  تمارين: "Fitness",
  جيم: "Fitness",
  فيتنس: "Fitness",
  "بناء عضلات": "Fitness",
  كمال: "Fitness",
  بودي: "Fitness",

  // Sports
  رياضة: "Sports",
  رياضه: "Sports",
  رياضي: "Sports",
  رياضيه: "Sports",
  سبورت: "Sports",
  كرة: "Sports",
  كره: "Sports",
  "كرة قدم": "Sports",
  "كرة سلة": "Sports",
  ملاكمة: "Sports",
  سباحة: "Sports",
  سباحه: "Sports",
  ماراثون: "Sports",

  // Food
  "فود بلوجر": "Food",
  فود: "Food",
  طبخ: "Food",
  وصفات: "Food",
  وصفه: "Food",
  أكل: "Food",
  اكل: "Food",
  طعام: "Food",
  مطبخ: "Food",
  كوكينج: "Food",
  شيف: "Food",
  مطاعم: "Food",
  حلويات: "Food",

  // Travel
  سفر: "Travel",
  سياحة: "Travel",
  سياحه: "Travel",
  ترافل: "Travel",
  رحلات: "Travel",
  سائح: "Travel",
  سائحه: "Travel",

  // Lifestyle
  يوميات: "Lifestyle",
  حياة: "Lifestyle",
  حياتي: "Lifestyle",
  حياتيّة: "Lifestyle",
  لايف: "Lifestyle",
  "ستايل حياة": "Lifestyle",

  // Tech
  تقنية: "Tech",
  تقنيه: "Tech",
  تكنولوجيا: "Tech",
  تقنيات: "Tech",
  تك: "Tech",
  برمجة: "Tech",
  برمجه: "Tech",
  ذكاء: "Tech",
  "ذكاء اصطناعي": "Tech",

  // Gaming
  ألعاب: "Gaming",
  العاب: "Gaming",
  لعبة: "Gaming",
  لعبه: "Gaming",
  جيمنج: "Gaming",
  جيمينج: "Gaming",
  بلايستيشن: "Gaming",
  اكس: "Gaming",

  // Entertainment
  ترفيه: "Entertainment",
  كوميديا: "Entertainment",
  كوميدي: "Entertainment",
  كوميديه: "Entertainment",
  فكاهة: "Entertainment",
  فكاهه: "Entertainment",
  مرح: "Entertainment",
  مسلسلات: "Entertainment",
  سينما: "Entertainment",

  // Parenting
  "أم شغوفة": "Parenting",
  "ام شغوفة": "Parenting",
  أمومة: "Parenting",
  امومة: "Parenting",
  أمهات: "Parenting",
  امهات: "Parenting",
  أم: "Parenting",
  ام: "Parenting",
  أمى: "Parenting",
  امى: "Parenting",
  طفل: "Parenting",
  أطفال: "Parenting",
  اطفال: "Parenting",
  عائلة: "Parenting",
  عائله: "Parenting",
  حمل: "Parenting",
  حوامل: "Parenting",
  رضاعة: "Parenting",
  رضاعه: "Parenting",
  تربية: "Parenting",
  تربيه: "Parenting",

  // Health & Wellness
  "صحة وعافية": "Health & Wellness",
  "صحه وعافية": "Health & Wellness",
  "صحة نفسية": "Health & Wellness",
  "صحه نفسية": "Health & Wellness",
  تغذية: "Health & Wellness",
  تغذيه: "Health & Wellness",
  صحة: "Health & Wellness",
  صحه: "Health & Wellness",
  دكتور: "Health & Wellness",
  دكتوره: "Health & Wellness",
  طبيب: "Health & Wellness",
  طبيبه: "Health & Wellness",
  صيدلي: "Health & Wellness",
  صيدلانيه: "Health & Wellness",
  دواء: "Health & Wellness",
  يوجا: "Health & Wellness",
  تأمل: "Health & Wellness",
  تامّل: "Health & Wellness",
  عافية: "Health & Wellness",
  عافيه: "Health & Wellness",
  نفسية: "Health & Wellness",
  نفسيه: "Health & Wellness",
  علاج: "Health & Wellness",
  حمية: "Health & Wellness",
  حميه: "Health & Wellness",
  دايت: "Health & Wellness",
};

/** Longest Arabic keys first so multi-word phrases win over single tokens. */
const ARABIC_KEYS_BY_LENGTH = Object.keys(ARABIC_CATEGORY_KEYWORDS).sort(
  (a, b) => b.length - a.length
);

/** True when the string contains Arabic script characters. */
export function containsArabicScript(value: string): boolean {
  return ARABIC_SCRIPT_RE.test(value);
}

/** Normalize Arabic text for dictionary lookup (diacritics, alef/yaa/taa variants). */
export function normalizeArabicCategoryText(value: string): string {
  return value
    .trim()
    .replace(ARABIC_DIACRITICS_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

/** Resolve one Arabic token (or phrase) to a canonical English category label. */
export function resolveArabicCategoryToken(token: string): CreatorCategoryLabel | null {
  const normalized = normalizeArabicCategoryText(token);
  if (!normalized || !containsArabicScript(normalized)) return null;

  const direct = ARABIC_CATEGORY_KEYWORDS[normalized];
  if (direct) return direct;

  for (const word of normalized.split(/\s+/)) {
    const match = ARABIC_CATEGORY_KEYWORDS[word];
    if (match) return match;
  }

  return null;
}

/** Scan free text for embedded Arabic category phrases (longest match first). */
export function inferCategoriesFromArabicText(text: string): CreatorCategoryLabel[] {
  if (!containsArabicScript(text)) return [];

  const normalized = normalizeArabicCategoryText(text);
  const categories: CreatorCategoryLabel[] = [];
  const seen = new Set<string>();

  for (const term of ARABIC_KEYS_BY_LENGTH) {
    const normTerm = normalizeArabicCategoryText(term);
    if (!normTerm || !normalized.includes(normTerm)) continue;

    const canonical = ARABIC_CATEGORY_KEYWORDS[term];
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    categories.push(canonical);
  }

  return categories;
}

/**
 * Translate an Arabic category label to its English canonical form when known.
 * Returns the original label when no mapping exists.
 */
export function translateArabicCategoryLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || !containsArabicScript(trimmed)) return trimmed;

  const resolved = resolveArabicCategoryToken(trimmed);
  if (resolved) return resolved;

  const fromText = inferCategoriesFromArabicText(trimmed);
  if (fromText.length === 1) return fromText[0];

  return trimmed;
}

/** Expand mixed Arabic/English terms into English tokens for keyword fallback. */
export function arabicCategoryEnglishFallbackTokens(text: string): string[] {
  return inferCategoriesFromArabicText(text).map((label) => label.toLowerCase());
}
