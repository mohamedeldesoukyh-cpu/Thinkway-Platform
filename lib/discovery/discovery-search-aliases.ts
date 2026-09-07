/**
 * Discovery Search Phase 3A — deterministic in-memory aliases / transliteration.
 *
 * Reuses CREATOR_CATEGORY_KEYWORDS + ARABIC_CATEGORY_KEYWORDS plus a small curated
 * MENA chat-alphabet table. Expansion is intentionally narrow (core category
 * English + paired transliterations) to limit false positives.
 */
import {
  ARABIC_CATEGORY_KEYWORDS,
  normalizeArabicCategoryText,
} from "@/lib/creators/arabic-category-keywords";
import {
  CREATOR_CATEGORY_KEYWORDS,
  CREATOR_CATEGORY_LABELS,
  type CreatorCategoryLabel,
} from "@/lib/creators/category-keywords";

/** Curated Arabic ↔ Latin chat-alphabet pairs (evidence-based, small). */
const TRANSLITERATION_EXTRAS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["مطاعم", ["mat3am", "mataam", "matam", "mata3em"]],
  ["مطعم", ["mat3am", "mataam", "matam"]],
  ["طبخ", ["tabkh", "tabkha"]],
  ["اكل", ["akl", "akel"]],
  ["طعام", ["taam"]],
  ["حلويات", ["halaweyat", "halawiyat"]],
  ["مكياج", ["mekaj", "mekab"]],
  ["ميكاب", ["mekab"]],
  ["تجميل", ["tagmeel", "tajmeel"]],
  ["عنايه", ["enaya", "inaya"]],
  ["عناية", ["enaya", "inaya"]],
  ["موضه", ["moda", "mouda"]],
  ["ازياء", ["azya", "azyaa"]],
  ["فاشن", ["fashn"]],
  ["لياقه", ["lyaqa", "liyaqa"]],
  ["رياضه", ["riyada", "reyada"]],
  ["تمارين", ["tamareen", "tamaren"]],
  ["سفر", ["safar"]],
  ["سياحه", ["seyaha", "siaha"]],
  ["يوميات", ["yawmeyat", "yomeyat"]],
  ["تقنيه", ["taqnia"]],
  ["تكنولوجيا", ["teknologya"]],
  ["العاب", ["aleab", "al3ab"]],
  ["ترفيه", ["tarfeeh"]],
  ["كوميديا", ["komedia"]],
  ["امومه", ["omoma", "umoma"]],
  ["اطفال", ["atfal"]],
  ["صحه", ["seha", "siha"]],
];

/** Tight English cores per category — not the full keyword dump. */
const CATEGORY_CORE_ENGLISH: Readonly<Record<CreatorCategoryLabel, readonly string[]>> = {
  Beauty: ["beauty", "makeup", "skincare"],
  Fashion: ["fashion", "style"],
  Fitness: ["fitness", "gym", "workout"],
  Food: ["food", "restaurant", "restaurants", "cooking"],
  Travel: ["travel", "tourism"],
  Lifestyle: ["lifestyle"],
  Automotive: ["automotive", "cars"],
  Tech: ["tech", "technology"],
  Gaming: ["gaming", "gamer"],
  Sports: ["sports", "sport"],
  Parenting: ["parenting", "mom", "family"],
  "Health & Wellness": ["health", "wellness"],
  Entertainment: ["entertainment", "comedy"],
  PR: ["pr"],
};

/** Primary Arabic forms exposed when expanding from English niches. */
const CATEGORY_PRIMARY_ARABIC: Readonly<Partial<Record<CreatorCategoryLabel, readonly string[]>>> = {
  Beauty: ["مكياج", "تجميل"],
  Fashion: ["ازياء", "موضه"],
  Fitness: ["لياقه", "تمارين"],
  Food: ["مطاعم", "طبخ"],
  Travel: ["سفر", "سياحه"],
  Lifestyle: ["يوميات"],
  Tech: ["تقنيه", "تكنولوجيا"],
  Gaming: ["العاب"],
  Sports: ["رياضه"],
  Parenting: ["امومه", "اطفال"],
  "Health & Wellness": ["صحه"],
  Entertainment: ["ترفيه", "كوميديا"],
};

const CANONICAL_CATEGORY_TERMS = new Set(
  CREATOR_CATEGORY_LABELS.map((label) => label.toLowerCase())
);

const CURATED_TRANSLITERATION_LATIN: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const [, forms] of TRANSLITERATION_EXTRAS) {
    for (const form of forms) {
      const n = form.toLowerCase().replace(/\s+/g, " ").trim();
      if (n.length >= 3) set.add(n);
    }
  }
  return set;
})();

/** Latin transliteration → Arabic peers (normalized). */
const LATIN_TO_ARABIC: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, Set<string>>();
  for (const [arabic, forms] of TRANSLITERATION_EXTRAS) {
    const ar = normalizeArabicCategoryText(arabic);
    for (const form of forms) {
      const latin = form.toLowerCase().trim();
      if (!map.has(latin)) map.set(latin, new Set());
      map.get(latin)!.add(ar);
    }
  }
  return new Map([...map].map(([k, v]) => [k, [...v]] as const));
})();

/** Arabic term → latin peers. */
const ARABIC_TO_LATIN: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const [arabic, forms] of TRANSLITERATION_EXTRAS) {
    const ar = normalizeArabicCategoryText(arabic);
    map.set(
      ar,
      forms.map((f) => f.toLowerCase().trim()).filter((f) => f.length >= 3)
    );
  }
  return map;
})();

/** Normalized term → category label when known. */
const TERM_TO_CATEGORY: ReadonlyMap<string, CreatorCategoryLabel> = (() => {
  const map = new Map<string, CreatorCategoryLabel>();
  for (const [keyword, label] of Object.entries(CREATOR_CATEGORY_KEYWORDS)) {
    map.set(keyword.toLowerCase(), label as CreatorCategoryLabel);
  }
  for (const [keyword, label] of Object.entries(ARABIC_CATEGORY_KEYWORDS)) {
    map.set(normalizeArabicCategoryText(keyword), label);
  }
  for (const [arabic] of TRANSLITERATION_EXTRAS) {
    const ar = normalizeArabicCategoryText(arabic);
    const label =
      ARABIC_CATEGORY_KEYWORDS[arabic] ?? ARABIC_CATEGORY_KEYWORDS[ar];
    if (label) map.set(ar, label);
  }
  for (const [latin, arabicList] of LATIN_TO_ARABIC) {
    for (const ar of arabicList) {
      const label = map.get(ar);
      if (label) {
        map.set(latin, label);
        break;
      }
    }
  }
  return map;
})();

const DICTIONARY_TERMS_BY_LENGTH = [...TERM_TO_CATEGORY.keys()].sort(
  (a, b) => b.length - a.length || a.localeCompare(b)
);

export type DiscoverySearchAliasCluster = {
  category: string | null;
  terms: readonly string[];
};

export function listDiscoverySearchAliasClusters(): readonly DiscoverySearchAliasCluster[] {
  const byCategory = new Map<string, Set<string>>();
  for (const [term, category] of TERM_TO_CATEGORY) {
    if (!byCategory.has(category)) byCategory.set(category, new Set());
    byCategory.get(category)!.add(term);
    for (const core of CATEGORY_CORE_ENGLISH[category] ?? []) {
      byCategory.get(category)!.add(core);
    }
    for (const ar of CATEGORY_PRIMARY_ARABIC[category] ?? []) {
      byCategory.get(category)!.add(normalizeArabicCategoryText(ar));
    }
  }
  return [...byCategory.entries()].map(([category, terms]) => ({
    category,
    terms: [...terms].sort((a, b) => b.length - a.length || a.localeCompare(b)),
  }));
}

export function isCuratedTransliterationTerm(normalizedToken: string): boolean {
  return CURATED_TRANSLITERATION_LATIN.has(normalizedToken.trim().toLowerCase());
}

export function shouldExpandDiscoverySearchTerm(normalizedToken: string): boolean {
  const key = normalizedToken.trim();
  if (!key) return false;
  if (CANONICAL_CATEGORY_TERMS.has(key.toLowerCase())) return false;
  if (/[\u0600-\u06FF]/.test(key)) return TERM_TO_CATEGORY.has(normalizeArabicCategoryText(key));
  if (isCuratedTransliterationTerm(key)) return true;
  const lower = key.toLowerCase();
  // English niche alias (foodie, makeup, …) — not the canonical label itself.
  return TERM_TO_CATEGORY.has(lower) && !CANONICAL_CATEGORY_TERMS.has(lower);
}

function pushUnique(out: string[], seen: Set<string>, term: string): void {
  const t = term.trim();
  if (!t || t.length < 2) return;
  const key = /[\u0600-\u06FF]/.test(t) ? t : t.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(/[\u0600-\u06FF]/.test(t) ? t : t.toLowerCase());
}

/**
 * Resolve deterministic aliases for a normalized token/phrase.
 * Narrow set: category core English + paired transliterations + primary Arabic.
 */
export function resolveDiscoverySearchAliases(
  normalizedToken: string,
  options?: { maxAliases?: number }
): string[] {
  const key = normalizedToken.trim();
  if (!key) return [];
  if (!shouldExpandDiscoverySearchTerm(key)) return [];

  const maxAliases = options?.maxAliases ?? 5;
  const lookupKey = /[\u0600-\u06FF]/.test(key)
    ? normalizeArabicCategoryText(key)
    : key.toLowerCase();
  const category = TERM_TO_CATEGORY.get(lookupKey);
  const seen = new Set<string>([lookupKey]);
  const out: string[] = [];

  if (category) {
    pushUnique(out, seen, category.toLowerCase());
    for (const core of CATEGORY_CORE_ENGLISH[category] ?? []) {
      pushUnique(out, seen, core);
      if (out.length >= maxAliases) return out.slice(0, maxAliases);
    }
  }

  // Paired transliteration forms for this exact term.
  if (/[\u0600-\u06FF]/.test(lookupKey)) {
    for (const latin of ARABIC_TO_LATIN.get(lookupKey) ?? []) {
      pushUnique(out, seen, latin);
      if (out.length >= maxAliases) return out.slice(0, maxAliases);
    }
  } else {
    for (const arabic of LATIN_TO_ARABIC.get(lookupKey) ?? []) {
      pushUnique(out, seen, arabic);
      if (out.length >= maxAliases) return out.slice(0, maxAliases);
    }
  }

  // When expanding from English niche, include a couple primary Arabic forms.
  if (category && !/[\u0600-\u06FF]/.test(lookupKey)) {
    for (const ar of CATEGORY_PRIMARY_ARABIC[category] ?? []) {
      pushUnique(out, seen, normalizeArabicCategoryText(ar));
      if (out.length >= maxAliases) return out.slice(0, maxAliases);
    }
  }

  return out.slice(0, maxAliases);
}

export function matchDiscoverySearchAliasPhrase(
  normalizedQuery: string
): { phrase: string; aliases: string[] } | null {
  const q = normalizedQuery.trim();
  if (!q) return null;

  const direct =
    TERM_TO_CATEGORY.has(q) || TERM_TO_CATEGORY.has(q.toLowerCase())
      ? /[\u0600-\u06FF]/.test(q)
        ? normalizeArabicCategoryText(q)
        : q.toLowerCase()
      : null;
  if (direct && shouldExpandDiscoverySearchTerm(direct)) {
    return { phrase: q, aliases: resolveDiscoverySearchAliases(direct) };
  }

  for (const term of DICTIONARY_TERMS_BY_LENGTH) {
    if (term.length < 3) continue;
    if (q === term || q.toLowerCase() === term) {
      if (!shouldExpandDiscoverySearchTerm(term)) return null;
      return { phrase: q, aliases: resolveDiscoverySearchAliases(term) };
    }
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:\\s|$)`, "u");
    if (re.test(q) || re.test(q.toLowerCase())) {
      if (!shouldExpandDiscoverySearchTerm(term)) continue;
      return { phrase: term, aliases: resolveDiscoverySearchAliases(term) };
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
