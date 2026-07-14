/**
 * Taxonomy expansion — data-driven, confidence-gated growth of
 * CREATOR_CATEGORY_KEYWORDS from real creator signals.
 *
 * Mechanism: a term is proposed as `keyword → Category` ONLY when creators that
 * are ALREADY resolved prove the association — the term must appear in enough
 * resolved creators (support), those creators must agree on one category
 * (share), and the term must actually recover unresolved creators (recovery).
 * Terms with heavy unresolved usage but no resolved co-occurrence are surfaced
 * as NEW-category candidates for human review — the pipeline never invents
 * canonical categories on its own.
 *
 * Pure functions only; the ops script does the I/O and the map edit.
 */
import { COUNTRY_ALIASES } from "@/lib/creators/country-code";
import { PLATFORM_LABELS } from "@/lib/social/platforms";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

/** Generic tokens that must never become taxonomy keywords. */
const NOISE_TERMS = new Set<string>([
  ...Object.keys(COUNTRY_ALIASES),
  ...Object.keys(PLATFORM_LABELS),
  ...Object.values(PLATFORM_LABELS).map((label) => label.toLowerCase()),
  "love", "life", "daily", "official", "page", "follow", "following", "link",
  "bio", "dm", "email", "business", "contact", "new", "best", "world", "the",
  "and", "for", "you", "your", "with", "content", "creator", "creators",
  "influencer", "video", "videos", "post", "posts", "story", "reel", "reels",
  "channel", "subscribe", "live", "show", "free", "shop", "sale", "brand",
  "media", "digital", "online", "here", "join", "check", "watch", "click",
  "egypt", "cairo", "dubai", "uae", "saudi", "ksa", "riyadh", "jeddah",
  "alexandria", "arabic", "english", "arab", "middle", "east", "mena",
]);

const TERM_PATTERN = /^[\p{L}][\p{L}\p{N}'&-]{2,29}$/u;

/** Normalize one raw signal token/phrase into a candidate term (or null). */
export function normalizeSignalTerm(raw: string | null | undefined): string | null {
  const term = raw
    ?.trim()
    .replace(/^[#@]+/, "")
    .toLowerCase()
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!term || term.length < 3) return null;
  if (NOISE_TERMS.has(term)) return null;
  if (!TERM_PATTERN.test(term.replace(/\s/g, ""))) return null;
  return term;
}

/** Unique candidate terms (unigrams + bigrams) from every profile signal. */
export function extractSignalTerms(creator: Pick<
  UnifiedCreatorResult,
  "bio" | "hashtags" | "mentions" | "audience_interests" | "ai_niche" | "display_name" | "recent_publications"
>): string[] {
  const terms = new Set<string>();
  const addToken = (raw: string | null | undefined) => {
    const term = normalizeSignalTerm(raw);
    if (term) terms.add(term);
  };
  const addText = (text: string | null | undefined) => {
    if (!text?.trim()) return;
    const tokens = text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .split(/[^\p{L}\p{N}'&-]+/u)
      .filter(Boolean);
    for (let i = 0; i < tokens.length; i += 1) {
      addToken(tokens[i]);
      if (i + 1 < tokens.length) addToken(`${tokens[i]} ${tokens[i + 1]}`);
    }
  };

  for (const tag of creator.hashtags ?? []) addToken(tag);
  for (const interest of creator.audience_interests ?? []) addToken(interest);
  addText(creator.ai_niche);
  addText(creator.bio);
  addText(creator.display_name);
  for (const publication of (creator.recent_publications ?? []).slice(0, 10)) {
    addText(publication.caption);
  }
  return [...terms];
}

export type ExpansionOptions = {
  /** Minimum resolved creators containing the term. */
  minSupport: number;
  /** Minimum share of those creators agreeing on ONE category (0..1). */
  minShare: number;
  /** Minimum unresolved creators the term would recover. */
  minRecovery: number;
  /**
   * Maximum false-positive risk (0..1): share of resolved carriers whose
   * categories CONTRADICT the proposed one. Applying a keyword adds its
   * category to every carrier, so contradicting carriers measure exactly how
   * much wrong signal the mapping would inject into already-resolved profiles.
   */
  maxFalsePositiveRisk: number;
  /** Maximum distinct categories among resolved carriers (ambiguity cap). */
  maxAmbiguity: number;
  /** Unresolved frequency that flags a NEW-category candidate. */
  newCategoryThreshold: number;
};

export const DEFAULT_EXPANSION_OPTIONS: ExpansionOptions = {
  minSupport: 5,
  minShare: 0.7,
  minRecovery: 3,
  maxFalsePositiveRisk: 0.3,
  maxAmbiguity: 3,
  newCategoryThreshold: 15,
};

export type ExpansionProposal = {
  term: string;
  category: string;
  /** Resolved creators containing the term. */
  support: number;
  /** Share of resolved carriers agreeing on the category (0..1). */
  share: number;
  /** Unresolved creators this mapping would recover. */
  recovery: number;
  /** Share of resolved carriers whose categories contradict the proposal (0..1). */
  falsePositiveRisk: number;
  /** Distinct categories among resolved carriers. */
  ambiguity: number;
};

export type NewCategoryCandidate = {
  /** Representative term of the cluster (highest recovery). */
  label: string;
  terms: string[];
  /** Unresolved creators covered by the cluster. */
  recovery: number;
};

export type ExpansionReport = {
  proposals: ExpansionProposal[];
  newCategoryCandidates: NewCategoryCandidate[];
  /** Unresolved creators recovered if all proposals are applied (unique). */
  projectedRecovered: number;
};

export type ResolvedSignal = { terms: string[]; categories: string[] };
export type UnresolvedSignal = { id: string; terms: string[] };

/**
 * Propose keyword→category mappings from co-occurrence evidence, and cluster
 * heavily-used unmapped terms into NEW-category candidates (human review).
 */
export function proposeTaxonomyExpansions(
  resolved: ReadonlyArray<ResolvedSignal>,
  unresolved: ReadonlyArray<UnresolvedSignal>,
  existingKeywords: ReadonlySet<string>,
  options: ExpansionOptions = DEFAULT_EXPANSION_OPTIONS
): ExpansionReport {
  const resolvedByTerm = new Map<string, Map<string, number>>();
  for (const creator of resolved) {
    for (const term of creator.terms) {
      if (existingKeywords.has(term)) continue;
      const byCategory = resolvedByTerm.get(term) ?? new Map<string, number>();
      for (const category of creator.categories) {
        byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
      }
      resolvedByTerm.set(term, byCategory);
    }
  }

  const unresolvedByTerm = new Map<string, Set<string>>();
  for (const creator of unresolved) {
    for (const term of creator.terms) {
      if (existingKeywords.has(term)) continue;
      const set = unresolvedByTerm.get(term) ?? new Set<string>();
      set.add(creator.id);
      unresolvedByTerm.set(term, set);
    }
  }

  const proposals: ExpansionProposal[] = [];
  for (const [term, byCategory] of resolvedByTerm) {
    const support = [...byCategory.values()].reduce((a, b) => a + b, 0);
    if (support < options.minSupport) continue;
    const ranked = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    const [topCategory, topCount] = ranked[0]!;
    // Tie between categories = ambiguous term — reject as noise.
    if (ranked[1] && ranked[1][1] === topCount) continue;
    const share = topCount / support;
    if (share < options.minShare) continue;
    const ambiguity = ranked.length;
    if (ambiguity > options.maxAmbiguity) continue;
    const falsePositiveRisk = 1 - share;
    if (falsePositiveRisk > options.maxFalsePositiveRisk) continue;
    const recovery = unresolvedByTerm.get(term)?.size ?? 0;
    if (recovery < options.minRecovery) continue;
    proposals.push({
      term,
      category: topCategory,
      support,
      share,
      recovery,
      falsePositiveRisk,
      ambiguity,
    });
  }
  proposals.sort((a, b) => b.recovery - a.recovery || b.share - a.share);

  // Projected recovery: unique unresolved creators carrying ≥1 proposed term.
  const recoveredIds = new Set<string>();
  const proposedTerms = new Set(proposals.map((p) => p.term));
  for (const creator of unresolved) {
    if (creator.terms.some((term) => proposedTerms.has(term))) recoveredIds.add(creator.id);
  }

  // NEW-category candidates: heavy unresolved usage, no resolved evidence —
  // greedy Jaccard clustering over carrier sets so related terms group.
  const candidates = [...unresolvedByTerm.entries()]
    .filter(
      ([term, ids]) =>
        ids.size >= options.newCategoryThreshold &&
        ([...(resolvedByTerm.get(term)?.values() ?? [])].reduce((a, b) => a + b, 0) <
          options.minSupport)
    )
    .sort((a, b) => b[1].size - a[1].size);

  const clusters: Array<{ label: string; terms: string[]; ids: Set<string> }> = [];
  for (const [term, ids] of candidates) {
    let placed = false;
    for (const cluster of clusters) {
      const intersection = [...ids].filter((id) => cluster.ids.has(id)).length;
      const union = cluster.ids.size + ids.size - intersection;
      if (union > 0 && intersection / union >= 0.5) {
        cluster.terms.push(term);
        for (const id of ids) cluster.ids.add(id);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ label: term, terms: [term], ids: new Set(ids) });
  }

  return {
    proposals,
    newCategoryCandidates: clusters.map((cluster) => ({
      label: cluster.label,
      terms: cluster.terms,
      recovery: cluster.ids.size,
    })),
    projectedRecovered: recoveredIds.size,
  };
}
