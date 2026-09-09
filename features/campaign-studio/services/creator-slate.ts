import {
  canonicalTierLabel,
  matchesInfluencerTier,
  normalizeInfluencerTier,
  type InfluencerTier,
} from "@/lib/creators/influencer-tier";
import { resolveCreatorTierLabel, type CreatorTierLabel } from "@/lib/creators/creator-tier";
import { resolveDiscoveryPlatform } from "@/lib/social/platforms";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { SearchCreatorCardItem } from "./creator-platform-utils";
import { creatorFitsPreferredCategories } from "./studio-creator-category-fit";

/**
 * Strategy-coherent slate composition: the recommended creator list must
 * execute the approved strategy — right platforms (a TikTok brief never
 * recommends IG-only creators) and a tier distribution that tracks the
 * strategy mix (Macro 40% → ~40% of the slate), with per-creator content
 * concepts matched to what the creator actually makes.
 */

export type TierMixTarget = { tier: string; percent: number };

export type SlateCompositionMeta = {
  requestedMix: TierMixTarget[];
  achievedMix: Array<{ tier: string; count: number; percent: number }>;
  platformFiltered: boolean;
  platformFallback: boolean;
  /** Preferred categories after Lifestyle hygiene. */
  preferredCategories?: string[];
  /** True when off-category creators were required to reach a workable slate. */
  categoryFallback?: boolean;
  offCategoryPadCount?: number;
  categoryFallbackReason?: string;
  /** Slate size the campaign asked for, after category/inventory limits. */
  targetCount?: number;
  /** Creators actually placed. Below `targetCount` when the mix ran out of supply. */
  achievedCount?: number;
  /**
   * Per-tier supply shortage against the Strategy allocation. Present only for
   * tiers that could not be filled — the planner sees the gap instead of it
   * being papered over with creators from a tier the Strategy never asked for.
   */
  tierShortfall?: Array<{ tier: string; requested: number; achieved: number }>;
};

/** Lowercased tier labels accepted per strategy-mix tier name. */
const TIER_ALIASES: Record<string, string[]> = {
  celebrity: ["celebrity"],
  mega: ["mega"],
  macro: ["macro"],
  mid: ["mid"],
  "mid-tier": ["mid"],
  micro: ["micro"],
  nano: ["nano"],
};

/**
 * Product verticals — when these are preferred without a mass mix, generic
 * Lifestyle must not count as an on-brief category match.
 */
const PRODUCT_VERTICAL_TOKENS = [
  "beauty",
  "skincare",
  "fashion",
  "fitness",
  "travel",
  "adventure",
  "food",
  "tech",
  "technology",
  "gaming",
  "parenting",
  "family",
  "automotive",
] as const;

/** Mass-reach mix — Lifestyle stays on-brief alongside Sports / Entertainment. */
const MASS_MIX_TOKENS = ["sports", "sport", "entertainment", "comedy", "music"] as const;

function tokenMatches(haystack: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => haystack === token || haystack.includes(token) || token.includes(haystack));
}

function isProductVertical(token: string): boolean {
  return tokenMatches(token.trim().toLowerCase(), PRODUCT_VERTICAL_TOKENS);
}

function isMassMixCategory(token: string): boolean {
  return tokenMatches(token.trim().toLowerCase(), MASS_MIX_TOKENS);
}

/**
 * Drop generic Lifestyle from preferred categories when a commercial product
 * vertical is already stated — unless the brief is a mass Sports/Entertainment mix.
 */
export function sanitizePreferredCategories(categories: string[]): string[] {
  const normalized = [
    ...new Set(categories.map((c) => c.trim().toLowerCase()).filter(Boolean)),
  ];
  const hasProductVertical = normalized.some(isProductVertical);
  const hasMassMix = normalized.some(isMassMixCategory);
  if (hasProductVertical && !hasMassMix) {
    return normalized.filter((c) => c !== "lifestyle");
  }
  return normalized;
}

const FIT_FLOOR = 60;
/** Drop near-zero engagement when stronger commercial options exist. */
const ENGAGEMENT_FLOOR = 0.5;
const MIN_VERTICAL_SLATE = 5;
const MAX_QUALITY_SLATE = 10;

/** Canonical platform slug via the shared taxonomy (no local alias table). */
function normalizePlatformKey(platform: string): string {
  return resolveDiscoveryPlatform(platform) ?? platform.trim().toLowerCase();
}

export function creatorTierOf(creator: Pick<SearchCreatorCardItem, "followers">): CreatorTierLabel {
  return resolveCreatorTierLabel({ followers: creator.followers ?? 0 });
}

/** True when a follower-tier label satisfies a strategy-mix tier name. */
export function matchesTierLabel(mixTier: string, tierLabel: string): boolean {
  const mixKey = mixTier.trim().toLowerCase();
  const accepted = TIER_ALIASES[mixKey] ?? [mixKey];
  const normalizedLabel = normalizeInfluencerTier(tierLabel)?.toLowerCase() ?? tierLabel.trim().toLowerCase();
  return accepted.includes(normalizedLabel) || matchesInfluencerTier(mixTier, tierLabel);
}

/** Canonical display label for any tier/role spelling; passes through unknown roles. */
export function normalizeTierLabel(tier: string): string {
  return canonicalTierLabel(tier);
}

/** Largest-remainder allocation of slate slots per tier percent. */
export function allocateTierCounts(mix: TierMixTarget[], targetCount: number): Map<string, number> {
  const totalPercent = mix.reduce((sum, m) => sum + Math.max(0, m.percent), 0) || 1;
  const raw = mix.map((m) => ({
    tier: m.tier.toLowerCase(),
    exact: (Math.max(0, m.percent) / totalPercent) * targetCount,
  }));
  const counts = new Map<string, number>();
  let assigned = 0;
  for (const r of raw) {
    const base = Math.floor(r.exact);
    counts.set(r.tier, base);
    assigned += base;
  }
  const remainders = raw
    .map((r) => ({ tier: r.tier, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; assigned < targetCount && remainders.length > 0; i += 1) {
    const tier = remainders[i % remainders.length]!.tier;
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
    assigned += 1;
  }
  return counts;
}

function creatorMatchesPreferredCategories(
  creator: Pick<SearchCreatorCardItem, "categories" | "handle" | "displayName">,
  preferredCategories: string[]
): boolean {
  return creatorFitsPreferredCategories(
    {
      categories: creator.categories,
      handle: creator.handle,
      displayName: creator.displayName,
    },
    preferredCategories
  );
}

function fitScoreOf(creator: SearchCreatorCardItem): number {
  return creator.campaignRelevanceScore ?? 100;
}

export function composeCreatorSlate(
  creators: SearchCreatorCardItem[],
  options: {
    platforms?: string[];
    tierMix?: TierMixTarget[];
    targetCount?: number;
    /** Preferred CIP categories — soft bias; pad off-category only when justified. */
    preferredCategories?: string[];
    /**
     * When true (enterprise mandatory platform), never fall back to off-platform
     * creators — an empty/on-platform slate is required.
     */
    strictPlatform?: boolean;
  }
): { creators: SearchCreatorCardItem[]; meta: SlateCompositionMeta } {
  const preferredCategories = sanitizePreferredCategories(options.preferredCategories ?? []);
  const requestedPlatforms = (options.platforms ?? [])
    .map(normalizePlatformKey)
    .filter(Boolean);

  // Hard platform constraint: an explicit brief platform excludes off-platform
  // creators entirely; fall back to the unfiltered pool only when the filter
  // would leave the slate empty-handed — unless strictPlatform (mandatory).
  let pool = creators;
  let platformFiltered = false;
  let platformFallback = false;
  if (requestedPlatforms.length > 0) {
    const filtered = creators.filter((c) =>
      requestedPlatforms.includes(normalizePlatformKey(c.platform))
    );
    if (options.strictPlatform) {
      pool = filtered;
      platformFiltered = true;
      platformFallback = false;
    } else if (
      filtered.length > 0 &&
      filtered.length >= Math.min(3, options.targetCount ?? creators.length)
    ) {
      pool = filtered;
      platformFiltered = true;
    } else {
      platformFallback = true;
    }
  }

  const withTier = pool.map((c) => ({ ...c, tier: c.tier ?? creatorTierOf(c) }));

  // Prefer fewer excellent creators. Creators below FIT_FLOOR should not pad a
  // slate when stronger fits exist. When *no* creator meets the floor but the
  // pool is non-empty, keep the best-scored creators — an empty slate blocks
  // Approve → Generate and is worse than a conservative near-floor shortlist.
  const scored = withTier.filter((c) => c.campaignRelevanceScore != null);
  const unscored = withTier.filter((c) => c.campaignRelevanceScore == null);
  const strongFit = (scored.length > 0 ? scored : withTier).filter(
    (c) => fitScoreOf(c) >= FIT_FLOOR
  );
  const bestAvailable =
    scored.length > 0
      ? [...scored].sort((a, b) => fitScoreOf(b) - fitScoreOf(a))
      : withTier;
  const fitPool =
    scored.length > 0
      ? strongFit.length > 0
        ? strongFit
        : bestAvailable
      : withTier.length > 0
        ? withTier
        : unscored;
  const engaged = fitPool.filter(
    (c) => c.engagementRate == null || c.engagementRate >= ENGAGEMENT_FLOOR
  );
  const fitBiased =
    engaged.length >= Math.min(3, options.targetCount ?? (engaged.length || 1))
      ? engaged
      : fitPool;

  let orderedPool = fitBiased;
  let categoryFallback = false;
  let offCategoryPadCount = 0;
  let categoryFallbackReason: string | undefined;
  const requestedTarget = options.targetCount ?? fitBiased.length;
  let effectiveTarget = Math.min(requestedTarget, fitBiased.length);

  // MAX_QUALITY_SLATE keeps an UNSPECIFIED slate short — it must never override
  // a quantity the campaign actually asked for. An explicit target raises the
  // ceiling to itself; without one the established cap of 10 still applies.
  const qualityCeiling =
    options.targetCount != null
      ? Math.max(MAX_QUALITY_SLATE, options.targetCount)
      : MAX_QUALITY_SLATE;

  if (preferredCategories.length > 0) {
    // Vertical briefs: prefer quality over filling a long generic slate.
    effectiveTarget = Math.min(effectiveTarget, qualityCeiling);
    const onCategory = fitBiased.filter((c) =>
      creatorMatchesPreferredCategories(c, preferredCategories)
    );
    const offCategory = fitBiased.filter(
      (c) => !creatorMatchesPreferredCategories(c, preferredCategories)
    );
    const verticalLabel = preferredCategories
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .join(", ");

    // Prefer a short on-category slate (≥3) over padding with off-brief creators
    // just to hit a longer count — boardroom quality over completeness.
    const MIN_ON_CATEGORY_NO_PAD = 3;
    if (onCategory.length >= MIN_ON_CATEGORY_NO_PAD) {
      orderedPool = onCategory;
      effectiveTarget = Math.min(effectiveTarget, onCategory.length, qualityCeiling);
    } else if (onCategory.length > 0 && onCategory.length >= requestedTarget) {
      // Requested slate is small enough to stay fully on-category.
      orderedPool = onCategory;
      effectiveTarget = Math.min(effectiveTarget, onCategory.length);
    } else if (onCategory.length > 0) {
      // Truly thin inventory (<3 on-category) — pad with adjacent creators and explain.
      orderedPool = [...onCategory, ...offCategory];
      categoryFallback = true;
      const padTarget = Math.min(MIN_VERTICAL_SLATE, orderedPool.length, MAX_QUALITY_SLATE);
      offCategoryPadCount = Math.max(0, padTarget - onCategory.length);
      effectiveTarget = Math.min(padTarget, orderedPool.length);
      categoryFallbackReason =
        `Only ${onCategory.length} ${verticalLabel} creator${onCategory.length === 1 ? "" : "s"} matched inventory — ` +
        `padded with adjacent categories to reach a workable slate of ${effectiveTarget}.`;
    } else if (offCategory.length > 0) {
      orderedPool = offCategory;
      categoryFallback = true;
      offCategoryPadCount = Math.min(MIN_VERTICAL_SLATE, offCategory.length);
      effectiveTarget = Math.min(MIN_VERTICAL_SLATE, offCategory.length, MAX_QUALITY_SLATE);
      categoryFallbackReason =
        `No ${verticalLabel} creators matched inventory — recommending adjacent-category creators ` +
        `while mandatory country/platform gates still apply.`;
    }
  }

  const targetCount = Math.min(effectiveTarget, orderedPool.length);
  const mix = (options.tierMix ?? []).filter((m) => m.percent > 0);
  if (mix.length === 0) {
    const slate = orderedPool.slice(0, targetCount);
    const padded = slate.filter(
      (c) =>
        preferredCategories.length > 0 &&
        !creatorMatchesPreferredCategories(c, preferredCategories)
    ).length;
    return {
      creators: slate,
      meta: {
        requestedMix: [],
        achievedMix: summarizeMix(slate),
        platformFiltered,
        platformFallback,
        preferredCategories,
        categoryFallback: categoryFallback || padded > 0,
        offCategoryPadCount: categoryFallback ? Math.max(offCategoryPadCount, padded) : padded,
        categoryFallbackReason,
        targetCount,
        achievedCount: slate.length,
      },
    };
  }

  const counts = allocateTierCounts(mix, targetCount);
  const used = new Set<string>();
  const slate: SearchCreatorCardItem[] = [];

  for (const m of mix) {
    const tierKey = m.tier.toLowerCase();
    const accepted = TIER_ALIASES[tierKey] ?? [tierKey];
    let remaining = counts.get(tierKey) ?? 0;
    for (const creator of orderedPool) {
      if (remaining <= 0) break;
      if (used.has(creator.id)) continue;
      if (!accepted.includes((creator.tier ?? "").toLowerCase())) continue;
      slate.push(creator);
      used.add(creator.id);
      remaining -= 1;
    }
  }

  // Backfill toward the requested quantity from tiers the Strategy ASKED FOR —
  // a tier that has spare supply may over-fill to cover one that ran dry, which
  // is still an on-strategy recommendation.
  //
  // A creator whose tier the Strategy never named is NEVER pulled in to make
  // the number look complete: that is how a Macro/Micro/Nano campaign ended up
  // recommending Celebrity and Mega. When the requested tiers cannot supply the
  // full quantity the slate comes up short and `tierShortfall` says exactly
  // where, so the planner can decide rather than being handed a silent swap.
  const strategyTierKeys = mix.map((m) => m.tier.toLowerCase());
  const inStrategyMix = (creator: SearchCreatorCardItem): boolean =>
    strategyTierKeys.some((tierKey) =>
      (TIER_ALIASES[tierKey] ?? [tierKey]).includes((creator.tier ?? "").toLowerCase())
    );

  /**
   * Only a creator whose tier is KNOWN and absent from the mix is a
   * substitution. A creator with no follower data resolves to "Unknown" — that
   * is missing data, not a different tier, and dropping those would empty
   * slates built from sources that carry no follower counts.
   */
  const isSubstitution = (creator: SearchCreatorCardItem): boolean => {
    const label = (creator.tier ?? "").toLowerCase();
    if (!label || label === "unknown") return false;
    return !inStrategyMix(creator);
  };

  for (const creator of orderedPool) {
    if (slate.length >= targetCount) break;
    if (used.has(creator.id)) continue;
    if (isSubstitution(creator)) continue;
    slate.push(creator);
    used.add(creator.id);
  }

  const achievedByTier = new Map<string, number>();
  for (const creator of slate) {
    const label = (creator.tier ?? creatorTierOf(creator)).toLowerCase();
    achievedByTier.set(label, (achievedByTier.get(label) ?? 0) + 1);
  }
  const tierShortfall = mix
    .map((m) => {
      const tierKey = m.tier.toLowerCase();
      const accepted = TIER_ALIASES[tierKey] ?? [tierKey];
      const achieved = [...achievedByTier.entries()]
        .filter(([label]) => accepted.includes(label))
        .reduce((sum, [, count]) => sum + count, 0);
      return { tier: m.tier, requested: counts.get(tierKey) ?? 0, achieved };
    })
    .filter((entry) => entry.achieved < entry.requested);

  const padded = slate.filter(
    (c) =>
      preferredCategories.length > 0 &&
      !creatorMatchesPreferredCategories(c, preferredCategories)
  ).length;

  return {
    creators: slate,
    meta: {
      requestedMix: mix,
      achievedMix: summarizeMix(slate),
      platformFiltered,
      platformFallback,
      preferredCategories,
      categoryFallback: categoryFallback || padded > 0,
      offCategoryPadCount: categoryFallback ? Math.max(offCategoryPadCount, padded) : padded,
      categoryFallbackReason,
      targetCount,
      achievedCount: slate.length,
      ...(tierShortfall.length > 0 ? { tierShortfall } : {}),
    },
  };
}

function summarizeMix(
  slate: SearchCreatorCardItem[]
): Array<{ tier: string; count: number; percent: number }> {
  const byTier = new Map<string, number>();
  for (const c of slate) {
    const tier = (c.tier ?? creatorTierOf(c)).toLowerCase();
    byTier.set(tier, (byTier.get(tier) ?? 0) + 1);
  }
  return [...byTier.entries()].map(([tier, count]) => ({
    tier,
    count,
    percent: slate.length > 0 ? Math.round((count / slate.length) * 100) : 0,
  }));
}

/** Sound-first content concepts by creator category — trend/song campaigns. */
const TREND_CONCEPTS: Array<{ pattern: RegExp; idea: string }> = [
  { pattern: /danc/i, idea: "Dance challenge on the official sound — choreography simple enough to copy" },
  { pattern: /comed|funn|skit/i, idea: "Comedy skit where the official sound punchlines a relatable summer moment" },
  { pattern: /fashion|style|outfit/i, idea: "Summer outfit transition cut to the official sound's beat drop" },
  { pattern: /travel|beach|adventure/i, idea: "Beach/summer vlog montage scored with the official sound" },
  { pattern: /food|cook|recipe/i, idea: "Fast-cut cooking montage synced to the official sound" },
  { pattern: /fitness|gym|workout|sport/i, idea: "Workout transition challenge using the official sound" },
  { pattern: /family|mom|parent|kids/i, idea: "Family/kids dance reaction to the official sound" },
  { pattern: /beauty|makeup|skincare/i, idea: "Get-ready-with-me transition on the official sound" },
  { pattern: /music|sing|artist/i, idea: "Lip-sync / remix interpretation of the official sound" },
  { pattern: /lifestyle|vlog|daily/i, idea: "Day-in-my-summer POV set to the official sound" },
];

const TREND_FALLBACKS = [
  "Lip-sync or duet on the official sound with a personal twist",
  "Trend adaptation: creator's signature format cut to the official sound",
  "Creative interpretation of the official sound that invites audience remakes",
];

const GENERIC_CONCEPTS = [
  "Authentic product-in-life story in the creator's native format",
  "Before/after or transformation format tailored to the brief objective",
  "Audience-participation hook (duet, stitch, or comment prompt)",
];

/** True when the campaign is a sound/trend activation (e&-style briefs). */
export function isTrendCampaign(facts?: Pick<CampaignFacts, "objective" | "rawBriefExcerpt">): boolean {
  const text = [facts?.objective, facts?.rawBriefExcerpt].filter(Boolean).join(" ");
  return /\bsong\b|\bsound\b|\bjingle\b|\btrend\b|\bviral\b|\banthem\b|music/i.test(text);
}

/** Per-creator content concept matched to the creator's category. */
export function buildCreatorContentIdea(
  creator: Pick<SearchCreatorCardItem, "categories">,
  facts: Pick<CampaignFacts, "objective" | "rawBriefExcerpt"> | undefined,
  fallbackIndex = 0
): string {
  const categories = (creator.categories ?? []).join(" ");
  if (isTrendCampaign(facts)) {
    for (const { pattern, idea } of TREND_CONCEPTS) {
      if (pattern.test(categories)) return idea;
    }
    return TREND_FALLBACKS[fallbackIndex % TREND_FALLBACKS.length]!;
  }
  for (const { pattern, idea } of TREND_CONCEPTS) {
    if (pattern.test(categories)) return idea.replace(/the official sound/gi, "the campaign creative");
  }
  return GENERIC_CONCEPTS[fallbackIndex % GENERIC_CONCEPTS.length]!;
}

export type { InfluencerTier };
