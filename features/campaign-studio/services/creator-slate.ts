import { resolveCreatorTierLabel, type CreatorTierLabel } from "@/lib/creators/creator-tier";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { SearchCreatorCardItem } from "./creator-platform-utils";

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
};

/** Lowercased tier labels accepted per strategy-mix tier name. */
const TIER_ALIASES: Record<string, string[]> = {
  celebrity: ["celebrity"],
  mega: ["celebrity", "macro"],
  macro: ["macro"],
  mid: ["mid-tier"],
  "mid-tier": ["mid-tier"],
  micro: ["micro"],
  nano: ["nano"],
};

function normalizePlatformKey(platform: string): string {
  const v = platform.trim().toLowerCase();
  if (v.includes("insta") || v === "ig") return "instagram";
  if (v.includes("tiktok") || v === "tt") return "tiktok";
  if (v.includes("youtube") || v === "yt") return "youtube";
  if (v.includes("snap")) return "snapchat";
  return v;
}

export function creatorTierOf(creator: Pick<SearchCreatorCardItem, "followers">): CreatorTierLabel {
  return resolveCreatorTierLabel({ followers: creator.followers ?? 0 });
}

/** True when a follower-tier label satisfies a strategy-mix tier name (e.g. "Mid" → "Mid-Tier"). */
export function matchesTierLabel(mixTier: string, tierLabel: string): boolean {
  const accepted = TIER_ALIASES[mixTier.trim().toLowerCase()] ?? [mixTier.trim().toLowerCase()];
  return accepted.includes(tierLabel.trim().toLowerCase());
}

const CANONICAL_TIER_LABELS: Record<string, string> = {
  celebrity: "Celebrity",
  mega: "Celebrity",
  macro: "Macro",
  mid: "Mid-Tier",
  "mid-tier": "Mid-Tier",
  micro: "Micro",
  nano: "Nano",
};

/** Canonical display label for any tier/role spelling; passes through unknown roles. */
export function normalizeTierLabel(tier: string): string {
  const key = tier.trim().toLowerCase();
  return CANONICAL_TIER_LABELS[key] ?? tier.trim();
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

export function composeCreatorSlate(
  creators: SearchCreatorCardItem[],
  options: {
    platforms?: string[];
    tierMix?: TierMixTarget[];
    targetCount?: number;
  }
): { creators: SearchCreatorCardItem[]; meta: SlateCompositionMeta } {
  const targetCount = Math.min(options.targetCount ?? creators.length, creators.length);
  const requestedPlatforms = (options.platforms ?? [])
    .map(normalizePlatformKey)
    .filter(Boolean);

  // Hard platform constraint: an explicit brief platform excludes off-platform
  // creators entirely; fall back to the unfiltered pool only when the filter
  // would leave the slate empty-handed.
  let pool = creators;
  let platformFiltered = false;
  let platformFallback = false;
  if (requestedPlatforms.length > 0) {
    const filtered = creators.filter((c) =>
      requestedPlatforms.includes(normalizePlatformKey(c.platform))
    );
    if (filtered.length >= Math.min(3, targetCount)) {
      pool = filtered;
      platformFiltered = true;
    } else {
      platformFallback = true;
    }
  }

  const withTier = pool.map((c) => ({ ...c, tier: c.tier ?? creatorTierOf(c) }));

  const mix = (options.tierMix ?? []).filter((m) => m.percent > 0);
  if (mix.length === 0) {
    const slate = withTier.slice(0, targetCount);
    return {
      creators: slate,
      meta: {
        requestedMix: [],
        achievedMix: summarizeMix(slate),
        platformFiltered,
        platformFallback,
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
    for (const creator of withTier) {
      if (remaining <= 0) break;
      if (used.has(creator.id)) continue;
      if (!accepted.includes((creator.tier ?? "").toLowerCase())) continue;
      slate.push(creator);
      used.add(creator.id);
      remaining -= 1;
    }
  }

  // Backfill under-supplied tiers with the best remaining creators by rank.
  for (const creator of withTier) {
    if (slate.length >= targetCount) break;
    if (used.has(creator.id)) continue;
    slate.push(creator);
    used.add(creator.id);
  }

  return {
    creators: slate,
    meta: {
      requestedMix: mix,
      achievedMix: summarizeMix(slate),
      platformFiltered,
      platformFallback,
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
