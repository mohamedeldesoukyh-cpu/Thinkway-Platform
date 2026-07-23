/**
 * Creator Priority Score — Stage 2 intelligent ranking for media plan scheduling.
 *
 * Ranks quotation activations by strategic fit (not quotation/alphabetical order).
 * Gracefully degrades when metrics are missing: tier, platform, and deliverable
 * type still produce a meaningful score.
 *
 * Signals used today:
 * - Tier, followers (when hydrated), engagement rate, quoted revenue
 * - Platform, deliverable role/round, service type (video vs story vs UGC)
 * - Campaign objective + journey phase weight profiles
 *
 * Phased (not yet wired — score neutral until data available):
 * - Video completion rate, brand safety score, audience overlap %
 */

import type { SlateCreator } from "./output-inputs";
import type { CampaignMoment } from "./media-plan-moments";
import { CAMPAIGN_MOMENT_LABELS } from "./media-plan-moments";
import type { SchedulableDeliverable } from "./media-plan-scheduler-types";
import {
  resolvePriorityWeights,
  type CreatorPriorityFactorKey,
  type MediaPlanPriorityWeights,
  type ResolvedPriorityWeights,
} from "./media-plan-priority-weights";

import type { DeliverableRole } from "./media-plan-deliverable-classification";

/** Publishing phase groups used before journey moments in scheduling order. */
export type SchedulingPublishingPhase = "hero" | "supporting" | "community" | "reinforcement" | "ugc";

export function classifySchedulingPublishingPhase(input: {
  role: DeliverableRole;
  creatorRound: number;
  tierRank: number;
}): SchedulingPublishingPhase {
  if (input.role === "ugc") return "ugc";
  if (input.creatorRound > 0) return "reinforcement";
  if (input.tierRank <= 1) return "hero";
  if (input.tierRank <= 2) return "supporting";
  return "community";
}

/** Normalised journey moment for comparing activations within the same publishing phase. */
export function comparisonPhaseForScheduling(deliverable: SchedulableDeliverable): CampaignMoment {
  const phase = classifySchedulingPublishingPhase({
    role: deliverable.role,
    creatorRound: deliverable.creatorRound,
    tierRank: deliverable.tierRank,
  });
  switch (phase) {
    case "hero":
      return "launch";
    case "supporting":
      return "amplification";
    case "community":
      return "momentum";
    case "reinforcement":
      return "momentum";
    case "ugc":
      return "ugc";
    default:
      return "momentum";
  }
}

/** Compare two activations for scheduling order (phase group, then priority score). */
export function compareDeliverablesByPriority(
  a: SchedulableDeliverable,
  b: SchedulableDeliverable,
  context: Omit<CreatorPriorityContext, "deliverable" | "phase"> = {}
): number {
  const phaseRank: Record<SchedulingPublishingPhase, number> = {
    hero: 0,
    supporting: 1,
    community: 2,
    reinforcement: 3,
    ugc: 4,
  };
  const pubA = classifySchedulingPublishingPhase(a);
  const pubB = classifySchedulingPublishingPhase(b);
  const phaseDelta = phaseRank[pubA] - phaseRank[pubB];
  if (phaseDelta !== 0) return phaseDelta;

  const scoreA = computeDeliverablePriorityScore(a, {
    ...context,
    phase: comparisonPhaseForScheduling(a),
  }).score;
  const scoreB = computeDeliverablePriorityScore(b, {
    ...context,
    phase: comparisonPhaseForScheduling(b),
  }).score;
  if (scoreB !== scoreA) return scoreB - scoreA;
  if (a.creatorRound !== b.creatorRound) return a.creatorRound - b.creatorRound;
  return a.tierRank - b.tierRank || a.slotId.localeCompare(b.slotId);
}

export type CreatorPriorityFactors = {
  performance: number;
  audience: number;
  creatorQuality: number;
  campaignFit: number;
};

export type CreatorPriorityResult = {
  score: number;
  factors: CreatorPriorityFactors;
  reasons: string[];
};

export type CreatorPriorityContext = {
  campaignObjective?: string;
  phase?: CampaignMoment;
  deliverable?: Pick<
    SchedulableDeliverable,
    "platform" | "role" | "creatorRound" | "serviceType" | "tierRank"
  >;
  targetPlatforms?: string[];
  priorityWeights?: Partial<MediaPlanPriorityWeights>;
};

export type SchedulingRationale = {
  creatorId: string;
  score: number;
  reasons: string[];
  phase: string;
  slotRank?: number;
  /** Market intelligence explainability — additive to creator reasons. */
  marketScore?: number;
  marketReasons?: string[];
  marketTradeoffs?: string[];
};

const TIER_REACH_SCORE: Record<string, number> = {
  celebrity: 100,
  mega: 100,
  macro: 85,
  "mid-tier": 70,
  mid: 70,
  micro: 55,
  nano: 40,
};

const TIER_ENGAGEMENT_BIAS: Record<string, number> = {
  celebrity: 35,
  mega: 40,
  macro: 55,
  "mid-tier": 72,
  mid: 72,
  micro: 88,
  nano: 82,
};

const PLATFORM_REACH_BIAS: Record<string, number> = {
  tiktok: 92,
  instagram: 78,
  youtube: 85,
  facebook: 65,
  snapchat: 70,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeTier(tier?: string): string {
  return tier?.trim().toLowerCase() ?? "";
}

function followersReachScore(followers?: number, tier?: string): { score: number; reason?: string } {
  if (followers != null && followers > 0) {
    const log = Math.log10(Math.max(1, followers));
    const score = clamp(((log - 3) / 3.7) * 100);
    return {
      score,
      reason: `${formatFollowers(followers)} followers — reach signal`,
    };
  }
  const tierKey = normalizeTier(tier);
  const tierScore = TIER_REACH_SCORE[tierKey] ?? 55;
  return {
    score: tierScore,
    reason: tierKey ? `${capitalizeTier(tierKey)} tier — reach proxy (followers unknown)` : "Tier unknown — neutral reach",
  };
}

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return String(count);
}

function capitalizeTier(tier: string): string {
  if (tier === "mid-tier" || tier === "mid") return "Mid-tier";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function engagementQualityScore(
  engagementRate?: number,
  tier?: string
): { score: number; reason?: string } {
  if (engagementRate != null && engagementRate > 0) {
    const score = clamp(engagementRate * 14);
    return {
      score,
      reason: `${engagementRate.toFixed(1)}% engagement rate`,
    };
  }
  const tierKey = normalizeTier(tier);
  const score = TIER_ENGAGEMENT_BIAS[tierKey] ?? 60;
  return {
    score,
    reason: tierKey
      ? `${capitalizeTier(tierKey)} typical engagement profile`
      : "Engagement data unavailable — tier-based estimate",
  };
}

function investmentSignal(quotedRevenue?: number): { score: number; reason?: string } {
  if (quotedRevenue == null || quotedRevenue <= 0) {
    return { score: 50 };
  }
  const log = Math.log10(Math.max(1, quotedRevenue));
  const score = clamp(((log - 3) / 3) * 100);
  return {
    score,
    reason: "Quoted investment reflects client priority",
  };
}

function platformFitScore(
  platform?: string,
  targetPlatforms?: string[]
): { score: number; reason?: string } {
  const key = (platform ?? "").trim().toLowerCase();
  const reachBias = PLATFORM_REACH_BIAS[key] ?? 60;
  if (targetPlatforms?.length) {
    const canonical = targetPlatforms.map((p) => p.trim().toLowerCase());
    const match = canonical.some((p) => key.includes(p) || p.includes(key));
    return {
      score: match ? clamp(reachBias + 12) : clamp(reachBias - 18),
      reason: match ? `${platform} aligns with campaign platforms` : `${platform} is secondary to campaign platforms`,
    };
  }
  return { score: reachBias, reason: platform ? `${platform} platform reach potential` : undefined };
}

function deliverableFitScore(
  deliverable?: CreatorPriorityContext["deliverable"]
): { score: number; reason?: string } {
  if (!deliverable) return { score: 55 };
  const label = deliverable.serviceType.toLowerCase();
  if (deliverable.role === "ugc") {
    return { score: 78, reason: "UGC format — participation-led" };
  }
  if (/\bvideo|reel|tt\b|tiktok/.test(label)) {
    const viralBoost = deliverable.tierRank <= 1 ? 88 : deliverable.tierRank <= 2 ? 75 : 65;
    return { score: viralBoost, reason: "Video/Reel — viral potential" };
  }
  if (/\bstory|stories/.test(label)) {
    return { score: 62, reason: "Stories — intimacy and frequency" };
  }
  if (deliverable.creatorRound > 0) {
    return { score: 58, reason: "Follow-up deliverable — sustainer role" };
  }
  return { score: 60 };
}

function applyPhaseMultipliers(
  factors: CreatorPriorityFactors,
  resolved: ResolvedPriorityWeights
): CreatorPriorityFactors {
  const keys: CreatorPriorityFactorKey[] = [
    "performance",
    "audience",
    "creatorQuality",
    "campaignFit",
  ];
  const adjusted = { ...factors };
  for (const key of keys) {
    const multiplier = resolved.phaseMultipliers[key] ?? 1;
    adjusted[key] = adjusted[key] * multiplier;
  }
  return adjusted;
}

function combineFactors(
  factors: CreatorPriorityFactors,
  resolved: ResolvedPriorityWeights
): number {
  const weighted =
    factors.performance * resolved.factors.performance +
    factors.audience * resolved.factors.audience +
    factors.creatorQuality * resolved.factors.creatorQuality +
    factors.campaignFit * resolved.factors.campaignFit;
  return clamp(weighted);
}

/** Score one creator for a scheduling context — 0–100 with explainability. */
export function computeCreatorPriorityScore(
  creator: SlateCreator,
  context: CreatorPriorityContext = {}
): CreatorPriorityResult {
  const reasons: string[] = [];
  const resolved = resolvePriorityWeights({
    campaignObjective: context.campaignObjective,
    phase: context.phase,
    metaOverrides: context.priorityWeights,
  });

  const reach = followersReachScore(creator.followers, creator.tier);
  const engagement = engagementQualityScore(creator.engagementRate, creator.tier);
  const investment = investmentSignal(creator.quotedRevenue);
  const platform = platformFitScore(
    context.deliverable?.platform ?? creator.platform,
    context.targetPlatforms
  );
  const deliverable = deliverableFitScore(context.deliverable);

  const tierReach = TIER_REACH_SCORE[normalizeTier(creator.tier)] ?? 55;
  const performance = clamp(reach.score * 0.5 + tierReach * 0.35 + (creator.views ? clamp(Math.log10(creator.views) * 18) : 0) * 0.15);
  const audience = clamp(platform.score * 0.55 + investment.score * 0.45);
  const creatorQuality = clamp(engagement.score * 0.7 + (creator.brandFit != null ? clamp(creator.brandFit) : engagement.score) * 0.3);
  const campaignFit = clamp(deliverable.score * 0.65 + platform.score * 0.35);

  if (reach.reason) reasons.push(reach.reason);
  if (engagement.reason) reasons.push(engagement.reason);
  if (platform.reason) reasons.push(platform.reason);
  if (deliverable.reason) reasons.push(deliverable.reason);
  if (investment.reason) reasons.push(investment.reason);

  const rawFactors: CreatorPriorityFactors = { performance, audience, creatorQuality, campaignFit };
  const phaseAdjusted = applyPhaseMultipliers(rawFactors, resolved);
  const score = combineFactors(phaseAdjusted, resolved);

  const displayFactors: CreatorPriorityFactors = {
    performance: clamp(phaseAdjusted.performance),
    audience: clamp(phaseAdjusted.audience),
    creatorQuality: clamp(phaseAdjusted.creatorQuality),
    campaignFit: clamp(phaseAdjusted.campaignFit),
  };

  if (context.phase) {
    reasons.push(
      `${CAMPAIGN_MOMENT_LABELS[context.phase]} phase emphasises ${phaseEmphasisSummary(resolved)}`
    );
  }
  reasons.push(`${resolved.objective} objective weighting applied`);

  return { score, factors: displayFactors, reasons };
}

function phaseEmphasisSummary(resolved: ResolvedPriorityWeights): string {
  const entries = Object.entries(resolved.phaseMultipliers) as Array<[CreatorPriorityFactorKey, number]>;
  const sorted = entries
    .filter(([, value]) => value != null && value > 1.05)
    .sort((a, b) => (b[1] ?? 1) - (a[1] ?? 1));
  if (!sorted.length) return "balanced signals";
  return sorted
    .slice(0, 2)
    .map(([key]) => factorLabel(key))
    .join(" and ");
}

function factorLabel(key: CreatorPriorityFactorKey): string {
  switch (key) {
    case "performance":
      return "reach";
    case "audience":
      return "audience fit";
    case "creatorQuality":
      return "engagement quality";
    case "campaignFit":
      return "campaign fit";
  }
}

/** Priority score for a schedulable activation (creator + deliverable context). */
export function computeDeliverablePriorityScore(
  deliverable: SchedulableDeliverable,
  context: Omit<CreatorPriorityContext, "deliverable"> = {}
): CreatorPriorityResult {
  return computeCreatorPriorityScore(deliverable.creator, {
    ...context,
    deliverable,
  });
}

/** Build explainability payload for a placement. */
export function buildSchedulingRationale(
  deliverable: SchedulableDeliverable,
  result: CreatorPriorityResult,
  phase: CampaignMoment,
  slotRank?: number,
  market?: { score?: number; reasons?: string[]; tradeoffs?: string[] }
): SchedulingRationale {
  return {
    creatorId: deliverable.creator.creatorId,
    score: Math.round(result.score * 10) / 10,
    reasons: result.reasons.slice(0, 6),
    phase: CAMPAIGN_MOMENT_LABELS[phase],
    slotRank,
    marketScore: market?.score != null ? Math.round(market.score * 10) / 10 : undefined,
    marketReasons: market?.reasons?.slice(0, 3),
    marketTradeoffs: market?.tradeoffs?.slice(0, 2),
  };
}

/** Sort activations by priority — highest first; stable tie-break on slotId. */
export function sortDeliverablesByPriority(
  deliverables: SchedulableDeliverable[],
  context: Omit<CreatorPriorityContext, "deliverable"> = {}
): SchedulableDeliverable[] {
  const scored = deliverables.map((deliverable) => ({
    deliverable,
    result: computeDeliverablePriorityScore(deliverable, context),
  }));
  scored.sort(
    (a, b) =>
      b.result.score - a.result.score ||
      a.deliverable.tierRank - b.deliverable.tierRank ||
      a.deliverable.slotId.localeCompare(b.deliverable.slotId)
  );
  return scored.map((entry) => entry.deliverable);
}

/** Sort within a phase/week — preserves quotation activations, reorders WHO goes WHEN. */
export function sortDeliverablesForPhaseSlotAssignment(
  deliverables: SchedulableDeliverable[],
  phase: CampaignMoment,
  context: Omit<CreatorPriorityContext, "deliverable" | "phase"> = {}
): Array<{ deliverable: SchedulableDeliverable; result: CreatorPriorityResult }> {
  const scored = deliverables.map((deliverable) => ({
    deliverable,
    result: computeDeliverablePriorityScore(deliverable, { ...context, phase }),
  }));
  scored.sort(
    (a, b) =>
      b.result.score - a.result.score ||
      a.deliverable.tierRank - b.deliverable.tierRank ||
      a.deliverable.deliverableIndex - b.deliverable.deliverableIndex
  );
  return scored;
}

/** Sort activations for journey week allocation — phase-aware per deliverable. */
export function rankDeliverablesForJourney(
  deliverables: SchedulableDeliverable[],
  resolvePhase: (deliverable: SchedulableDeliverable) => CampaignMoment,
  context: Omit<CreatorPriorityContext, "deliverable" | "phase"> = {}
): Array<{ deliverable: SchedulableDeliverable; result: CreatorPriorityResult }> {
  const scored = deliverables.map((deliverable) => ({
    deliverable,
    result: computeDeliverablePriorityScore(deliverable, {
      ...context,
      phase: resolvePhase(deliverable),
    }),
  }));
  scored.sort(
    (a, b) =>
      b.result.score - a.result.score ||
      a.deliverable.tierRank - b.deliverable.tierRank ||
      a.deliverable.slotId.localeCompare(b.deliverable.slotId)
  );
  return scored;
}
