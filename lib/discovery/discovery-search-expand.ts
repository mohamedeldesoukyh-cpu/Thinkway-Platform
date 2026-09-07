/**
 * Discovery Search Phase 3A — query normalize + synonym/transliteration expand.
 *
 * In-memory only. Applied before FTS. Exact @handle / profile URL lookups are
 * preserved and never synonym-expanded.
 */
import {
  matchDiscoverySearchAliasPhrase,
  resolveDiscoverySearchAliases,
} from "@/lib/discovery/discovery-search-aliases";
import {
  isExactCreatorLookupSearch,
  normalizeDiscoverySearchQuery,
} from "@/lib/discovery/creator-search-query";
import { normalizeDiscoverySearchText } from "@/lib/discovery/discovery-search-normalize";

export { normalizeDiscoverySearchText } from "@/lib/discovery/discovery-search-normalize";

/** Max OR terms sent to search_creators (primary + aliases). */
export const DISCOVERY_SEARCH_MAX_OR_TERMS = 6;

export type PreparedDiscoverySearchQuery = {
  raw: string;
  /** Handle/URL normalized or text-normalized form (no OR expansion). */
  normalized: string;
  /** Query string for search_creators RPC. */
  rpcQuery: string;
  exactLookup: boolean;
  /** Alias/transliteration terms added (excluding primary). */
  expansions: string[];
  /** True when rpcQuery includes websearch OR expansion. */
  expanded: boolean;
};

function quoteWebsearchTerm(term: string): string {
  const t = term.trim();
  if (!t) return "";
  if (/\s/.test(t)) return `"${t.replace(/"/g, "")}"`;
  return t;
}

/**
 * Build a websearch_to_tsquery-safe OR query from primary + aliases.
 * Single-term queries only at call sites that need OR (see prepareDiscoverySearchQuery).
 */
export function buildDiscoverySearchOrQuery(
  primary: string,
  aliases: readonly string[]
): string {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of [primary, ...aliases]) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(quoteWebsearchTerm(t));
    if (terms.length >= DISCOVERY_SEARCH_MAX_OR_TERMS) break;
  }
  if (terms.length <= 1) return terms[0] ?? primary.trim();
  return terms.join(" OR ");
}

/**
 * Prepare a creator search query for FTS:
 * 1) Exact handle/URL → @handle only (no alias expansion)
 * 2) Normalize Arabic/English text
 * 3) Expand single-token / known-phrase queries with deterministic aliases
 *
 * Multi-word free text is normalized only (no OR) to avoid websearch
 * precedence false-positives (`a b OR c` ⇒ `(a & b) | c`).
 */
export function prepareDiscoverySearchQuery(
  rawInput: string
): PreparedDiscoverySearchQuery {
  const raw = typeof rawInput === "string" ? rawInput : "";
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      raw,
      normalized: "",
      rpcQuery: "",
      exactLookup: false,
      expansions: [],
      expanded: false,
    };
  }

  const handleNormalized = normalizeDiscoverySearchQuery(trimmed);
  const exactLookup = isExactCreatorLookupSearch(trimmed);

  if (exactLookup) {
    const normalized = handleNormalized || trimmed;
    return {
      raw,
      normalized,
      rpcQuery: normalized,
      exactLookup: true,
      expansions: [],
      expanded: false,
    };
  }

  // Prefer URL→handle normalize when it changed the string; else text normalize.
  const afterHandlePass =
    handleNormalized && handleNormalized !== trimmed
      ? handleNormalized
      : normalizeDiscoverySearchText(trimmed);

  const normalized = afterHandlePass || normalizeDiscoverySearchText(trimmed);
  if (!normalized) {
    return {
      raw,
      normalized: "",
      rpcQuery: trimmed,
      exactLookup: false,
      expansions: [],
      expanded: false,
    };
  }

  // Strip leading @ for thematic dictionary lookup (non-exact).
  const lookupKey = normalized.replace(/^@+/, "").trim();
  const tokens = lookupKey.split(/\s+/).filter(Boolean);

  let expansions: string[] = [];

  if (tokens.length === 1) {
    expansions = resolveDiscoverySearchAliases(tokens[0]!, { maxAliases: 5 });
  } else {
    // Multi-word: expand only when the full phrase (or one known phrase unit)
    // is a dictionary hit — never OR-expand free multi-word text.
    const phraseHit = matchDiscoverySearchAliasPhrase(lookupKey);
    if (phraseHit && phraseHit.phrase === lookupKey) {
      expansions = phraseHit.aliases;
    }
  }

  if (expansions.length === 0) {
    return {
      raw,
      normalized,
      rpcQuery: normalized,
      exactLookup: false,
      expansions: [],
      expanded: false,
    };
  }

  const rpcQuery = buildDiscoverySearchOrQuery(lookupKey, expansions);
  return {
    raw,
    normalized,
    rpcQuery,
    exactLookup: false,
    expansions,
    expanded: true,
  };
}
