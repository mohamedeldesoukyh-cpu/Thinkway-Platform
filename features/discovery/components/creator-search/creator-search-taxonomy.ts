export type DiscoverySearchTaxonomySource =
  | "category"
  | "interest"
  | "hashtag"
  | "audience_interest";

export type DiscoverySearchTaxonomy = {
  /** Normalized lowercase terms for O(1) lookup. */
  terms: ReadonlySet<string>;
  /** Total distinct terms loaded from the database. */
  count: number;
};

export type TaxonomyMatchLevel = "none" | "partial" | "all_words" | "full";

export type TaxonomyMatchResult = {
  level: TaxonomyMatchLevel;
  matchedTerms: string[];
};

const TAXONOMY_NORMALIZE = /[^a-z0-9\s-]+/g;

/** Normalize a taxonomy term or query token for matching. */
export function normalizeDiscoveryTaxonomyTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(TAXONOMY_NORMALIZE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a single word token (no spaces). */
export function normalizeDiscoveryTaxonomyWord(value: string): string {
  return normalizeDiscoveryTaxonomyTerm(value).replace(/\s+/g, "");
}

export function buildDiscoverySearchTaxonomyIndex(
  rawTerms: string[]
): DiscoverySearchTaxonomy {
  const terms = new Set<string>();
  for (const raw of rawTerms) {
    const normalized = normalizeDiscoveryTaxonomyTerm(raw);
    if (!normalized) continue;
    terms.add(normalized);
    for (const word of normalized.split(/\s+/)) {
      if (word.length >= 2) terms.add(word);
    }
  }
  return { terms, count: terms.size };
}

export function matchQueryAgainstTaxonomy(
  rawQuery: string,
  taxonomy: DiscoverySearchTaxonomy
): TaxonomyMatchResult {
  const stripped = rawQuery.trim().replace(/^@+/, "");
  const normalized = normalizeDiscoveryTaxonomyTerm(stripped);
  if (!normalized) return { level: "none", matchedTerms: [] };

  if (taxonomy.terms.has(normalized)) {
    return { level: "full", matchedTerms: [normalized] };
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const matchedWords = words.filter((word) => taxonomy.terms.has(word));

  if (words.length > 1 && matchedWords.length === words.length) {
    return { level: "all_words", matchedTerms: matchedWords };
  }

  if (matchedWords.length > 0) {
    return { level: "partial", matchedTerms: matchedWords };
  }

  return { level: "none", matchedTerms: [] };
}
