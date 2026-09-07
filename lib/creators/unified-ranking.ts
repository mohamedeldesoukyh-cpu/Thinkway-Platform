/**
 * Discovery Rank v2 — deterministic, explainable ranking for Creator Search.
 *
 * Phase 2: ranks AFTER Phase 1 fill accumulation, BEFORE page slice.
 * Never invents numeric metrics. Missing data lowers confidence / drops weight.
 * ECI is never a ranking signal (display SSOT only).
 */

import { getCreatorIntelligenceMode } from "@/lib/creator-intelligence/flags";
import { resolveCreatorIntelligence } from "@/lib/creator-intelligence/resolver";
import { categoriesIntersect } from "@/lib/creator-intelligence/taxonomy";
import { compareBrowseDefaultOrder } from "@/lib/creators/browse-pin-tier";
import type { DiscoveryCoverageIntent } from "@/lib/creators/discovery-coverage";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  scoreCreatorCampaignRelevance,
  type CampaignRelevanceBreakdown,
} from "@/lib/discovery/campaign-relevance-scoring";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

/** DNA-dependent signals (brand_fit, authenticity, dna_completeness, ai niche text). */
export function discoveryRankDnaSignalsEnabled(): boolean {
  return process.env.DISCOVERY_RANK_USE_DNA_SIGNALS === "1";
}

export type DiscoveryRankPath = "fts" | "category" | "filtered_fast" | "default";

export type DiscoveryRankV2Options = {
  intent?: DiscoveryCoverageIntent;
  /** When provided and non-empty, campaign-fit component activates. */
  campaignCriteria?: CampaignSearchCriterion[];
  /** Include DNA fields only when flag on AND values are present. */
  useDnaSignals?: boolean;
  /**
   * Max search_rank observed in the buffer (for FTS normalization).
   * When omitted, lexical component uses a soft log scale.
   */
  maxSearchRank?: number | null;
};

export type DiscoveryRankV2Components = {
  lexicalRelevance: number | null;
  categoryIntent: number | null;
  thinkwayCompleteness: number | null;
  freshness: number | null;
  engagement: number | null;
  audienceGeo: number | null;
  campaignFit: number | null;
  quality: number | null;
  /** DNA-gated optional signals — null when disabled or missing. */
  brandFit: number | null;
  dnaCompleteness: number | null;
};

export type DiscoveryRankV2Result = {
  score: number;
  confidence: number;
  components: DiscoveryRankV2Components;
  /** Active weight sum used as denominator (0–1 scale components). */
  activeWeight: number;
};

const WEIGHTS = {
  lexicalRelevance: 0.28,
  categoryIntent: 0.14,
  thinkwayCompleteness: 0.12,
  freshness: 0.1,
  engagement: 0.1,
  audienceGeo: 0.1,
  campaignFit: 0.12,
  quality: 0.08,
  brandFit: 0.08,
  dnaCompleteness: 0.04,
} as const;

function audienceOverlapScore(
  creator: UnifiedCreatorResult,
  audience?: string
): number | null {
  if (!audience?.trim()) return null;
  const tokens = audience
    .split(/[\s,;/]+/)
    .map(normalizeToken)
    .filter((token) => token.length > 2);
  if (tokens.length === 0) return null;

  const hasTextSignal = Boolean(
    creator.bio?.trim() ||
      creator.categories.length > 0 ||
      (creator.audience_interests?.length ?? 0) > 0 ||
      creator.ai_category ||
      creator.ai_niche
  );
  if (!hasTextSignal) return null;

  const haystack = [
    creator.bio ?? "",
    creator.display_name,
    ...creator.categories,
    ...(creator.audience_interests ?? []),
    creator.ai_category ?? "",
    creator.ai_niche ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return Math.min(1, hits / tokens.length);
}

function intelligenceCategoryScore(
  creator: UnifiedCreatorResult,
  intentCategories: string[]
): number {
  const intelligence = resolveCreatorIntelligence(creator);
  const resolved = intelligence.categories.value;
  if (categoriesIntersect(resolved, intentCategories)) return 1;

  const partialHaystack = [
    intelligence.niche.value ?? "",
    ...intelligence.topics.value,
  ]
    .join(" ")
    .toLowerCase();
  const partial = intentCategories.some((category) =>
    partialHaystack.includes(category.trim().toLowerCase())
  );
  if (partial) return 0.6;

  return resolved.length === 0 ? 0.4 : 0.15;
}

function categoryMatchScore(
  creator: UnifiedCreatorResult,
  intent?: DiscoveryCoverageIntent
): number | null {
  const intentCategories = [
    ...(intent?.categories ?? []),
    ...(intent?.niches ?? []),
  ]
    .map(normalizeToken)
    .filter(Boolean);

  if (intentCategories.length === 0) return null;

  if (getCreatorIntelligenceMode() === "on") {
    return intelligenceCategoryScore(creator, intentCategories);
  }

  const creatorCategories = [
    ...creator.categories,
    ...(creator.browse_category_tags ?? []),
    creator.ai_category ?? "",
    creator.ai_niche ?? "",
  ]
    .map(normalizeToken)
    .filter(Boolean);

  if (creatorCategories.length === 0) return null;

  const hits = intentCategories.filter((cat) =>
    creatorCategories.some((c) => c.includes(cat) || cat.includes(c))
  ).length;

  return Math.min(1, hits / intentCategories.length);
}

function geoFitScore(
  creator: UnifiedCreatorResult,
  intent?: DiscoveryCoverageIntent
): number | null {
  const target = intent?.country?.trim();
  if (!target) return null;
  const codes = [
    creator.country_code,
    ...(creator.country_codes ?? []),
    creator.estimated_country,
    ...creator.platforms.map((p) => p.audience_country),
  ]
    .map((c) => (c ?? "").trim().toUpperCase())
    .filter(Boolean);
  if (codes.length === 0) return null;
  const want = target.toUpperCase();
  return codes.some((c) => c === want) ? 1 : 0;
}

function audienceGeoScore(
  creator: UnifiedCreatorResult,
  intent?: DiscoveryCoverageIntent
): number | null {
  const audience = audienceOverlapScore(creator, intent?.audience);
  const geo = geoFitScore(creator, intent);
  if (audience == null && geo == null) return null;
  if (audience != null && geo != null) return audience * 0.6 + geo * 0.4;
  return audience ?? geo;
}

function availabilityScore(creator: UnifiedCreatorResult): number {
  switch (creator.enrichment_status) {
    case "enriched":
      return 1;
    case "partial":
      return 0.85;
    case "running":
    case "queued":
      return 0.7;
    case "failed":
      return 0.4;
    default:
      return 0.55;
  }
}

function qualityScore(creator: UnifiedCreatorResult, useDna: boolean): number {
  const confidence = Math.max(0, Math.min(1, creator.source_confidence ?? 0.5));
  const completeness =
    creator.profile_image_url && creator.bio
      ? 1
      : creator.profile_image_url || creator.bio
        ? 0.7
        : 0.4;
  if (useDna && creator.dna_completeness != null) {
    const dnaBoost = Math.max(0, Math.min(100, creator.dna_completeness)) / 100;
    return confidence * 0.45 + completeness * 0.25 + dnaBoost * 0.3;
  }
  return confidence * 0.55 + completeness * 0.45;
}

function thinkwayCompletenessScore(creator: UnifiedCreatorResult): number | null {
  if (creator.thinkway_score == null || !Number.isFinite(creator.thinkway_score)) {
    return null;
  }
  return Math.max(0, Math.min(100, creator.thinkway_score)) / 100;
}

function freshnessScore(creator: UnifiedCreatorResult): number | null {
  const iso = creator.last_enriched_at ?? creator.updated_at;
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.85;
  if (ageDays <= 90) return 0.65;
  if (ageDays <= 180) return 0.45;
  if (ageDays <= 365) return 0.3;
  return 0.15;
}

function engagementScore(creator: UnifiedCreatorResult): number | null {
  const er = creator.metrics?.engagement_rate?.value;
  const views = creator.metrics?.avg_views?.value;
  const parts: number[] = [];
  if (er != null && Number.isFinite(er) && er >= 0) {
    // Typical creator ER ~0.5–8%; cap soft at 10%.
    parts.push(Math.min(1, er / 10));
  }
  if (views != null && Number.isFinite(views) && views > 0) {
    parts.push(Math.min(1, Math.log10(views + 1) / 6));
  }
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function lexicalRelevanceScore(
  creator: UnifiedCreatorResult,
  maxSearchRank?: number | null
): number | null {
  const rank = creator.search_rank;
  if (rank == null || !Number.isFinite(rank)) return null;
  if (maxSearchRank != null && maxSearchRank > 0) {
    return Math.max(0, Math.min(1, rank / maxSearchRank));
  }
  // Soft normalize common FTS tier floors (1000 exact … 400 trigram).
  return Math.max(0, Math.min(1, rank / 1000));
}

function brandFitScore(
  creator: UnifiedCreatorResult,
  useDna: boolean
): number | null {
  if (!useDna) return null;
  if (creator.brand_fit_score == null || !Number.isFinite(creator.brand_fit_score)) {
    return null;
  }
  return Math.max(0, Math.min(100, creator.brand_fit_score)) / 100;
}

function dnaCompletenessComponent(
  creator: UnifiedCreatorResult,
  useDna: boolean
): number | null {
  if (!useDna) return null;
  if (creator.dna_completeness == null || !Number.isFinite(creator.dna_completeness)) {
    return null;
  }
  return Math.max(0, Math.min(100, creator.dna_completeness)) / 100;
}

function campaignFitScore(
  creator: UnifiedCreatorResult,
  criteria?: CampaignSearchCriterion[]
): number | null {
  if (!criteria?.some((c) => c.enabled && c.value.trim())) return null;
  const breakdown: CampaignRelevanceBreakdown = scoreCreatorCampaignRelevance(
    creator,
    criteria
  );
  return Math.max(0, Math.min(1, breakdown.score / 100));
}

/**
 * Discovery Rank v2 — weighted mean over *known* components only.
 * Missing signals are omitted (confidence = activeWeight / maxPossible).
 */
export function scoreDiscoveryRankV2(
  creator: UnifiedCreatorResult,
  options: DiscoveryRankV2Options = {}
): DiscoveryRankV2Result {
  const useDna = options.useDnaSignals ?? discoveryRankDnaSignalsEnabled();

  const components: DiscoveryRankV2Components = {
    lexicalRelevance: lexicalRelevanceScore(creator, options.maxSearchRank),
    categoryIntent: categoryMatchScore(creator, options.intent),
    thinkwayCompleteness: thinkwayCompletenessScore(creator),
    freshness: freshnessScore(creator),
    engagement: engagementScore(creator),
    audienceGeo: audienceGeoScore(creator, options.intent),
    campaignFit: campaignFitScore(creator, options.campaignCriteria),
    quality: qualityScore(creator, useDna),
    brandFit: brandFitScore(creator, useDna),
    dnaCompleteness: dnaCompletenessComponent(creator, useDna),
  };

  // Quality is always computable from slim fields — always present.
  let weighted = 0;
  let activeWeight = 0;
  let maxWeight = 0;

  const add = (key: keyof typeof WEIGHTS, value: number | null) => {
    const w = WEIGHTS[key];
    maxWeight += w;
    if (value == null || !Number.isFinite(value)) return;
    weighted += value * w;
    activeWeight += w;
  };

  add("lexicalRelevance", components.lexicalRelevance);
  add("categoryIntent", components.categoryIntent);
  add("thinkwayCompleteness", components.thinkwayCompleteness);
  add("freshness", components.freshness);
  add("engagement", components.engagement);
  add("audienceGeo", components.audienceGeo);
  add("campaignFit", components.campaignFit);
  add("quality", components.quality);
  add("brandFit", components.brandFit);
  add("dnaCompleteness", components.dnaCompleteness);

  const score = activeWeight > 0 ? weighted / activeWeight : 0;
  const confidence = maxWeight > 0 ? activeWeight / maxWeight : 0;

  return {
    score,
    confidence,
    components,
    activeWeight,
  };
}

/** @deprecated Prefer scoreDiscoveryRankV2 — kept for legacy callers/tests. */
function discoveryRankScore(
  creator: UnifiedCreatorResult,
  intent?: DiscoveryCoverageIntent
): number {
  return scoreDiscoveryRankV2(creator, { intent }).score;
}

function resolveMaxSearchRank(creators: UnifiedCreatorResult[]): number | null {
  let max = 0;
  for (const creator of creators) {
    const rank = creator.search_rank;
    if (rank != null && Number.isFinite(rank) && rank > max) max = rank;
  }
  return max > 0 ? max : null;
}

type RankedRow = {
  creator: UnifiedCreatorResult;
  index: number;
  rank: DiscoveryRankV2Result;
};

function buildRankedRows(
  creators: UnifiedCreatorResult[],
  options: DiscoveryRankV2Options
): RankedRow[] {
  const maxSearchRank = options.maxSearchRank ?? resolveMaxSearchRank(creators);
  const opts = { ...options, maxSearchRank };
  return creators.map((creator, index) => ({
    creator,
    index,
    rank: scoreDiscoveryRankV2(creator, opts),
  }));
}

/**
 * FTS fill sort — search_rank is the strongest prior, then Discovery Rank v2.
 */
export function sortCreatorsForFtsFill(
  creators: UnifiedCreatorResult[],
  options: DiscoveryRankV2Options = {}
): UnifiedCreatorResult[] {
  const rows = buildRankedRows(creators, options);
  rows.sort(
    (a, b) =>
      (b.creator.search_rank ?? 0) - (a.creator.search_rank ?? 0) ||
      b.rank.score - a.rank.score ||
      b.rank.confidence - a.rank.confidence ||
      a.creator.display_name.localeCompare(b.creator.display_name) ||
      a.index - b.index
  );
  return rows.map((row) => row.creator);
}

/**
 * Category fill sort — Discovery Rank v2, with original RPC (first-seen) order
 * as the stable tie-breaker. No Egypt pin.
 */
export function sortCreatorsForCategoryFill(
  creators: UnifiedCreatorResult[],
  options: DiscoveryRankV2Options = {}
): UnifiedCreatorResult[] {
  const rows = buildRankedRows(creators, options);
  rows.sort(
    (a, b) =>
      b.rank.score - a.rank.score ||
      b.rank.confidence - a.rank.confidence ||
      a.index - b.index
  );
  return rows.map((row) => row.creator);
}

/**
 * Filtered-fast fill sort — Egypt/default pin order remains the prior,
 * then Discovery Rank v2 within / across near ties.
 */
export function sortCreatorsForFilteredFastFill(
  creators: UnifiedCreatorResult[],
  options: DiscoveryRankV2Options = {},
  nowMs: number = Date.now()
): UnifiedCreatorResult[] {
  const rows = buildRankedRows(creators, options);
  rows.sort(
    (a, b) =>
      compareBrowseDefaultOrder(a.creator, b.creator, "desc", nowMs) ||
      b.rank.score - a.rank.score ||
      b.rank.confidence - a.rank.confidence ||
      a.index - b.index
  );
  return rows.map((row) => row.creator);
}

/** Rank unified browse rows — Egypt pin tiers, then Discovery Rank v2. */
export function sortUnifiedCreatorsByDiscoveryRank(
  creators: UnifiedCreatorResult[],
  intent?: DiscoveryCoverageIntent,
  nowMs: number = Date.now()
): UnifiedCreatorResult[] {
  return sortCreatorsForFilteredFastFill(creators, { intent }, nowMs);
}

export {
  discoveryRankScore,
  categoryMatchScore,
  audienceOverlapScore,
};
