import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignScoreSet } from "@/features/campaign-intelligence/types/section-schemas";

import type { SearchCreatorCardItem } from "./creator-platform-utils";
import { creatorTierOf, matchesTierLabel } from "./creator-slate";

/** Follower-to-impression proxy for organic creator content. */
const VIEW_RATE = 0.35;

/** Platform engagement-rate benchmarks (%) for the forecast comparison. */
const ER_BENCHMARKS: Record<string, number> = {
  tiktok: 5.5,
  instagram: 2.5,
  youtube: 3.5,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeId(id: string): string {
  return id.trim().replace(/^inf:/, "");
}

function matchesBriefPlatform(card: SearchCreatorCardItem, platforms?: string[]): boolean {
  if (!platforms || platforms.length === 0) return true;
  const cardPlatform = card.platform.toLowerCase();
  return platforms.some((p) => cardPlatform.includes(p.toLowerCase().replace(/\s+/g, "")));
}

export type CampaignScoreInput = {
  cards: SearchCreatorCardItem[];
  facts?: CampaignFacts;
  /** Persisted CIP fit scores keyed by creator id. */
  fitScores?: Record<string, number>;
  /** Strategy tier mix the slate should track. */
  tierMix?: Array<{ tier: string; percent: number }>;
  /** Manually added creators still waiting for an intelligence refresh. */
  unenrichedCreatorIds?: string[];
};

/**
 * Deterministic campaign-level scores recomputed from the applied slate.
 * Every score carries a basis line so the numbers stay explainable —
 * no black-box output, matching the grounding rules of the Studio.
 */
export function computeCampaignScores(input: CampaignScoreInput): CampaignScoreSet {
  const { cards, facts } = input;
  const basis: string[] = [];
  const totalFollowers = cards.reduce((sum, c) => sum + (c.followers ?? 0), 0);

  // Brand fit — persisted CIP relevance where available; unscored creators count neutral.
  const fitEntries = new Map(
    Object.entries(input.fitScores ?? {}).map(([id, score]) => [normalizeId(id), score])
  );
  const fitValues = cards.map((c) => fitEntries.get(normalizeId(c.id)) ?? 60);
  const scoredCount = cards.filter((c) => fitEntries.has(normalizeId(c.id))).length;
  const brandFit =
    cards.length === 0
      ? 40
      : clamp(fitValues.reduce((a, b) => a + b, 0) / cards.length);
  basis.push(
    `Brand fit: ${scoredCount}/${cards.length} creators carry persisted campaign fit scores (unscored count 60).`
  );

  // Audience match — brief-platform compliance plus tier-mix adherence.
  const onPlatform = cards.filter((c) => matchesBriefPlatform(c, facts?.platforms)).length;
  const platformShare = cards.length === 0 ? 0 : onPlatform / cards.length;
  const tierMix = input.tierMix ?? [];
  let tierAdherence = 100;
  if (tierMix.length > 0 && cards.length > 0) {
    const cardTiers = cards.map((card) => creatorTierOf(card));
    const deviation = tierMix.reduce((sum, target) => {
      const actualCount = cardTiers.filter((tier) => matchesTierLabel(target.tier, tier)).length;
      const actualPercent = (actualCount / cards.length) * 100;
      return sum + Math.abs(actualPercent - target.percent);
    }, 0);
    tierAdherence = clamp(100 - deviation / 2);
  }
  const audienceMatch = clamp(platformShare * 100 * 0.7 + tierAdherence * 0.3);
  basis.push(
    `Audience match: ${onPlatform}/${cards.length} creators on brief platforms; tier-mix adherence ${tierAdherence}/100.`
  );

  // Reach — log-scale follower coverage (10K→20, 1M→60, 100M→100).
  const reach =
    totalFollowers <= 0 ? 10 : clamp(20 * Math.log10(Math.max(totalFollowers, 10) / 1_000));
  basis.push(`Reach: combined audience ${totalFollowers.toLocaleString()} followers.`);

  // Engagement forecast — follower-weighted ER vs platform benchmark.
  let weightedEr = 0;
  let erWeight = 0;
  for (const card of cards) {
    if (card.engagementRate == null || !card.followers) continue;
    weightedEr += card.engagementRate * card.followers;
    erWeight += card.followers;
  }
  const avgEr = erWeight > 0 ? weightedEr / erWeight : null;
  const benchmarkPlatform = (facts?.platforms?.[0] ?? cards[0]?.platform ?? "").toLowerCase();
  const benchmark =
    Object.entries(ER_BENCHMARKS).find(([key]) => benchmarkPlatform.includes(key))?.[1] ?? 3.5;
  const engagementForecast =
    avgEr == null ? 50 : clamp(60 * (avgEr / benchmark), 20, 100);
  basis.push(
    avgEr == null
      ? "Engagement forecast: no engagement data on the slate — neutral 50."
      : `Engagement forecast: weighted ER ${avgEr.toFixed(1)}% vs ${benchmark}% platform benchmark.`
  );

  // Budget efficiency — projected impressions per budget unit (log-scaled).
  const budgetAmount = facts?.budget?.amount ?? 0;
  const projectedImpressions = totalFollowers * VIEW_RATE;
  let budgetEfficiency = 70;
  if (budgetAmount > 0 && projectedImpressions > 0) {
    const impressionsPerUnit = projectedImpressions / budgetAmount;
    budgetEfficiency = clamp(50 + 20 * Math.log10(Math.max(impressionsPerUnit, 0.01)));
    basis.push(
      `Budget efficiency: ~${Math.round(projectedImpressions).toLocaleString()} projected impressions against ${budgetAmount.toLocaleString()} ${facts?.budget?.currency ?? ""} (${impressionsPerUnit.toFixed(1)} per unit).`.replace("  ", " ")
    );
  } else {
    basis.push("Budget efficiency: no budget or reach data — neutral 70.");
  }

  // Content coverage — category diversity plus tier coverage of the strategy mix.
  const categories = new Set(
    cards.flatMap((c) => c.categories ?? []).map((c) => c.toLowerCase()).filter(Boolean)
  );
  const diversityScore = Math.min(categories.size / 5, 1) * 60;
  const targetTiers = [...new Set(tierMix.map((t) => t.tier))];
  const coveredTiers =
    targetTiers.length === 0
      ? 1
      : targetTiers.filter((tier) =>
          cards.some((c) => matchesTierLabel(tier, creatorTierOf(c)))
        ).length / targetTiers.length;
  const contentCoverage = clamp(diversityScore + coveredTiers * 40);
  basis.push(
    `Content coverage: ${categories.size} content categories; ${Math.round(coveredTiers * 100)}% of strategy tiers filled.`
  );

  // Risk — higher is safer; penalties for concentration and unverified picks.
  const unenriched = (input.unenrichedCreatorIds ?? []).length;
  const topFollowers = Math.max(...cards.map((c) => c.followers ?? 0), 0);
  const concentration = totalFollowers > 0 ? topFollowers / totalFollowers : 0;
  const offPlatform = cards.length - onPlatform;
  let risk = 85;
  risk -= Math.min(unenriched * 10, 30);
  if (concentration > 0.5 && cards.length > 1) risk -= 15;
  if (offPlatform > 0 && (facts?.platforms?.length ?? 0) > 0) risk -= 10;
  if (tierMix.length > 0 && coveredTiers < 1) risk -= 10;
  risk = clamp(risk, 5, 95);
  basis.push(
    `Risk: ${unenriched} creator${unenriched === 1 ? "" : "s"} pending intelligence refresh; top creator holds ${Math.round(concentration * 100)}% of combined reach.`
  );

  const overall = clamp(
    (brandFit * 20 +
      audienceMatch * 15 +
      reach * 15 +
      engagementForecast * 15 +
      budgetEfficiency * 15 +
      contentCoverage * 10 +
      risk * 10) /
      100
  );

  return {
    overall,
    brandFit,
    audienceMatch,
    reach,
    engagementForecast,
    budgetEfficiency,
    contentCoverage,
    risk,
    basis,
    updatedAt: new Date().toISOString(),
  };
}
