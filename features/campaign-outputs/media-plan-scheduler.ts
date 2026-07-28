/**
 * Publishing optimization — Account Director scheduling engine.
 *
 * The calendar answers: "What is the best publishing sequence to maximize
 * campaign performance?" — not "How do I fill empty cells?"
 *
 * Phases: Analyze → Prioritize → Distribute by score → Optimize days → Attach mirrors.
 */

import type { SlateCreator } from "./output-inputs";
import {
  allocateCountByWeights,
  normalizeWeekWeights,
  normalizeDeliverableTypeLabel,
  type MediaPlanSlotAssignment,
} from "./media-plan-schedule";
import {
  classifyDeliverableRole,
  collapseMirrorsToActivations,
  bundleCompanionsToActivations,
  formatActivationServiceLabel,
  type ClassifiedDeliverableUnit,
  type DeliverableRole,
  resolveUgcEarliestWeek,
} from "./media-plan-deliverable-classification";
import { allocateDeliverablesThroughCampaignJourney, immutableActivationsFromDeliverables } from "./media-plan-campaign-journey";
import {
  validateQuotationActivationContract,
  type ImmutableQuotationActivation,
} from "./media-plan-quotation-activations";
import {
  validateMediaPlanAgainstQuotation,
  type MediaPlanValidationResult,
} from "./media-plan-pre-render-validation";
import type {
  SchedulableDeliverable,
  ScheduledDeliverablePlacement,
} from "./media-plan-scheduler-types";
import { canonicalPlatformLabel } from "./platform-allocation";
import {
  buildSchedulingRationale,
  compareDeliverablesByPriority,
  computeCreatorPriorityScore,
  sortDeliverablesForPhaseSlotAssignment,
} from "./media-plan-creator-priority";
import type { MediaPlanPriorityWeights } from "./media-plan-priority-weights";
import { dominantMomentForWeek } from "./media-plan-moments";
import type { MarketSchedulingContext } from "@/features/market-intelligence";
import {
  marketDayPlacementBonus,
  scoreMarketOpportunityForDate,
} from "@/features/market-intelligence/market-intelligence-engine";
import { marketReasonsForPlacement } from "@/features/market-intelligence/market-timing-rationale";

export type { SchedulableDeliverable, ScheduledDeliverablePlacement } from "./media-plan-scheduler-types";
export type { ImmutableQuotationActivation } from "./media-plan-quotation-activations";

function toSchedulableDeliverable(unit: ClassifiedDeliverableUnit): SchedulableDeliverable {
  return {
    ...unit,
    attachedMirrors: (unit.attachedMirrors ?? []).map(toSchedulableDeliverable),
    attachedCompanions: (unit.attachedCompanions ?? []).map(toSchedulableDeliverable),
  };
}

const TIER_PRIORITY: Record<string, number> = {
  celebrity: 0,
  mega: 0,
  macro: 1,
  "mid-tier": 2,
  mid: 2,
  micro: 3,
  nano: 4,
};

/** Impact score per activation tier — mirrors score 0 (bundled, not a new moment). */
export const PUBLISHING_SCORE_BY_TIER: Record<string, number> = {
  celebrity: 100,
  mega: 100,
  macro: 85,
  "mid-tier": 70,
  mid: 70,
  micro: 55,
  nano: 40,
};

export const UGC_PUBLISHING_SCORE = 40;
export const MIRROR_PUBLISHING_SCORE = 0;

export type PublishingPhase = "hero" | "supporting" | "reinforcement" | "community" | "ugc";

export type ScheduleDeliverablesInput = {
  deliverables: SchedulableDeliverable[];
  durationWeeks: number;
  weekWeights?: number[];
  assignments?: MediaPlanSlotAssignment[];
  briefText?: string;
  campaignObjective?: string;
  targetPlatforms?: string[];
  priorityWeights?: Partial<MediaPlanPriorityWeights>;
  /** Market intelligence context — additive scheduling factor. */
  marketContext?: MarketSchedulingContext;
};

const PHASE_ORDER: Record<PublishingPhase, number> = {
  hero: 0,
  supporting: 1,
  community: 2,
  reinforcement: 3,
  ugc: 4,
};

function normalizeCreatorId(id: string): string {
  return id.trim().toLowerCase();
}

function tierRank(tier?: string): number {
  if (!tier) return 5;
  return TIER_PRIORITY[tier.trim().toLowerCase()] ?? 5;
}

/** Impact score for week-budget distribution and day optimization. */
export function publishingScore(deliverable: SchedulableDeliverable): number {
  if (!deliverable.countsAsActivation || deliverable.role === "mirror") {
    return MIRROR_PUBLISHING_SCORE;
  }
  if (deliverable.role === "ugc") return UGC_PUBLISHING_SCORE;
  const tier = deliverable.creator.tier?.trim().toLowerCase() ?? "";
  return PUBLISHING_SCORE_BY_TIER[tier] ?? 60;
}

/** Classify activations into campaign journey phases for wave-based allocation. */
export function classifyPublishingPhase(deliverable: SchedulableDeliverable): PublishingPhase {
  if (deliverable.role === "ugc") return "ugc";
  if (deliverable.creatorRound > 0) return "reinforcement";
  if (deliverable.tierRank <= 1) return "hero";
  if (deliverable.tierRank <= 2) return "supporting";
  return "community";
}

/** Parse "2× TT Video" into quantity + base label. */
export function parseServiceTypeQuantity(serviceType: string): { quantity: number; baseLabel: string } {
  const trimmed = serviceType.trim();
  const match = trimmed.match(/^(\d+)\s*×\s*(.+)$/i);
  if (match) {
    return { quantity: Math.max(1, Number.parseInt(match[1]!, 10)), baseLabel: match[2]!.trim() };
  }
  return { quantity: 1, baseLabel: trimmed };
}

export function platformForServiceType(serviceType: string, fallback: string): string {
  const lower = serviceType.toLowerCase();
  if (/\btt\b|tiktok|mirrored tt/.test(lower)) return "TikTok";
  if (/\bfb\b|facebook|mirrored fb/.test(lower)) return "Facebook";
  if (/\byt\b|youtube|mirrored yt/.test(lower)) return "YouTube";
  if (/\big\b|instagram|mirrored ig/.test(lower)) return "Instagram";
  return canonicalPlatformLabel(fallback);
}

function serviceTypeForCreator(creator: SlateCreator, platform: string): string {
  const format = tierRank(creator.tier) <= 1 ? "Reel" : "Post";
  return `1× ${platform} ${format}`;
}

function serviceTypesForCreator(creator: SlateCreator, platform: string): string[] {
  if (creator.serviceTypes?.length) return creator.serviceTypes;
  if (creator.serviceLabel?.trim()) {
    const parts = creator.serviceLabel
      .split(/\s*(?:\+|·)\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length) return parts;
  }
  return [serviceTypeForCreator(creator, platform)];
}

function buildSchedulableUnit(
  creator: SlateCreator,
  basePlatform: string,
  rawType: string,
  baseLabel: string,
  index: number,
  quantity: number,
  slotCounter: number
): SchedulableDeliverable {
  const rank = tierRank(creator.tier);
  const unitLabel = `1× ${baseLabel}`;
  const role = classifyDeliverableRole(unitLabel, creator, rank);
  return {
    slotId: `${creator.creatorId}:${slotCounter}`,
    creator,
    serviceType: unitLabel,
    platform: platformForServiceType(rawType, basePlatform),
    deliverableIndex: index + 1,
    deliverableTotal: quantity,
    creatorRound: index,
    tierRank: rank,
    role,
    countsAsActivation: role !== "mirror",
    attachedMirrors: [],
    attachedCompanions: [],
  };
}

/** Expand quotation lines into raw units before mirror collapse. */
export function expandRawSchedulableDeliverables(
  slate: SlateCreator[],
  platforms: string[]
): SchedulableDeliverable[] {
  const fallbackPlatform = platforms[0] ?? "Instagram";
  const deliverables: SchedulableDeliverable[] = [];
  let slotCounter = 0;

  for (const creator of slate) {
    const basePlatform = creator.platform ?? fallbackPlatform;
    for (const rawType of serviceTypesForCreator(creator, basePlatform)) {
      const { quantity, baseLabel } = parseServiceTypeQuantity(rawType);
      for (let index = 0; index < quantity; index += 1) {
        deliverables.push(
          buildSchedulableUnit(creator, basePlatform, rawType, baseLabel, index, quantity, slotCounter++)
        );
      }
    }
  }

  return deliverables;
}

/** Expand quotation lines into schedulable activations (mirrors + story companions bundled). */
export function expandSchedulableDeliverables(
  slate: SlateCreator[],
  platforms: string[]
): SchedulableDeliverable[] {
  const raw = expandRawSchedulableDeliverables(slate, platforms);
  const mirrored = collapseMirrorsToActivations(raw);
  return bundleCompanionsToActivations(mirrored.activations).map(toSchedulableDeliverable);
}

/** Immutable activation contract from quotation slate — every line accounted for. */
export function buildImmutableActivationsFromSlate(
  slate: SlateCreator[],
  platforms: string[],
  options?: { weekOneWeight?: number; campaignObjective?: string; briefText?: string }
): ImmutableQuotationActivation[] {
  const deliverables = expandSchedulableDeliverables(slate, platforms);
  const weekOneWeight = options?.weekOneWeight;
  const activations = immutableActivationsFromDeliverables(deliverables, {
    weekOneWeight,
    campaignObjective: options?.campaignObjective,
  });
  const validation = validateQuotationActivationContract(slate, activations);
  if (!validation.ok && process.env.NODE_ENV !== "production") {
    console.warn(
      `[media-plan] quotation contract mismatch: expected ${validation.expected} lines, accounted ${validation.accounted}`
    );
  }
  return activations;
}

/** Activation count — mirrors excluded. */
export function countSchedulableActivations(slate: SlateCreator[], platforms: string[]): number {
  return expandSchedulableDeliverables(slate, platforms).length;
}

function sortCreatorsByPriority(
  creators: SlateCreator[],
  context: { campaignObjective?: string; phase?: import("./media-plan-moments").CampaignMoment }
): SlateCreator[] {
  return [...creators].sort((a, b) => {
    const scoreA = computeCreatorPriorityScore(a, context).score;
    const scoreB = computeCreatorPriorityScore(b, context).score;
    return scoreB - scoreA || tierRank(a.tier) - tierRank(b.tier);
  });
}

/** Interleave first/second/… deliverables across creators — priority-ranked, not quotation order. */
export function orderDeliverablesForWeekAllocation(
  deliverables: SchedulableDeliverable[],
  context?: { campaignObjective?: string }
): SchedulableDeliverable[] {
  const byCreator = new Map<string, SchedulableDeliverable[]>();
  for (const deliverable of deliverables) {
    const key = normalizeCreatorId(deliverable.creator.creatorId);
    const list = byCreator.get(key) ?? [];
    list.push(deliverable);
    byCreator.set(key, list);
  }

  const creators = sortCreatorsByPriority(
    [...byCreator.values()].map((slots) => slots[0]!.creator),
    { campaignObjective: context?.campaignObjective, phase: "launch" }
  );
  const maxRounds = Math.max(...[...byCreator.values()].map((slots) => slots.length), 0);
  const ordered: SchedulableDeliverable[] = [];

  for (let round = 0; round < maxRounds; round += 1) {
    for (const creator of creators) {
      const slots = [...(byCreator.get(normalizeCreatorId(creator.creatorId)) ?? [])].sort(
        (a, b) => a.deliverableIndex - b.deliverableIndex
      );
      if (round < slots.length) {
        ordered.push(slots[round]!);
      }
    }
  }

  return ordered;
}

/**
 * Priority-aware ordering: publishing phase first, then creator score within phase.
 */
export function orderDeliverablesForOptimization(
  deliverables: SchedulableDeliverable[],
  context?: {
    campaignObjective?: string;
    targetPlatforms?: string[];
    priorityWeights?: Partial<MediaPlanPriorityWeights>;
    weekOneWeight?: number;
  }
): SchedulableDeliverable[] {
  return [...deliverables].sort((a, b) =>
    compareDeliverablesByPriority(a, b, {
      campaignObjective: context?.campaignObjective,
      targetPlatforms: context?.targetPlatforms,
      priorityWeights: context?.priorityWeights,
    })
  );
}

function resolveMinSpacingDays(
  totalDays: number,
  deliverableCount: number,
  creatorCount: number
): number {
  const avgPerCreator = deliverableCount / Math.max(1, creatorCount);
  if (avgPerCreator <= 1.01) return 4;
  const scaled = Math.floor(totalDays / (avgPerCreator + 1));
  return Math.max(4, Math.min(10, scaled));
}

type DayPlacementState = {
  dayLoad: number[];
  dayImpactScore: number[];
  dayCreators: Map<number, Set<string>>;
  creatorLastDay: Map<string, number>;
  weekDayHeroCount: Map<string, number>;
  weekDayMegaCount: Map<string, number>;
  minSpacing: number;
  allowConsecutive: boolean;
  spacingPenalty: number;
  marketContext?: MarketSchedulingContext;
};

function createPlacementState(
  totalDays: number,
  minSpacing: number,
  marketContext?: MarketSchedulingContext
): DayPlacementState {
  return {
    dayLoad: Array.from({ length: totalDays }, () => 0),
    dayImpactScore: Array.from({ length: totalDays }, () => 0),
    dayCreators: new Map(),
    creatorLastDay: new Map(),
    weekDayHeroCount: new Map(),
    weekDayMegaCount: new Map(),
    minSpacing,
    allowConsecutive: false,
    spacingPenalty: 55,
    marketContext,
  };
}

function dayCreatorsOn(state: DayPlacementState, absoluteDay: number): Set<string> {
  let set = state.dayCreators.get(absoluteDay);
  if (!set) {
    set = new Set();
    state.dayCreators.set(absoluteDay, set);
  }
  return set;
}

function isMegaTier(deliverable: SchedulableDeliverable): boolean {
  return deliverable.tierRank <= 1 && deliverable.role !== "ugc";
}

function scoreDayPlacement(
  state: DayPlacementState,
  deliverable: SchedulableDeliverable,
  absoluteDay: number,
  week: number,
  dayIndex: number
): number {
  const creatorId = normalizeCreatorId(deliverable.creator.creatorId);
  const onDay = dayCreatorsOn(state, absoluteDay);

  if (onDay.has(creatorId)) return Number.POSITIVE_INFINITY;

  let score = (state.dayLoad[absoluteDay] ?? 0) * 18;
  const impact = publishingScore(deliverable);

  const lastDay = state.creatorLastDay.get(creatorId);
  if (lastDay != null) {
    const gap = absoluteDay - lastDay;
    if (!state.allowConsecutive && Math.abs(gap) === 1) {
      score += 2_500;
    }
    if (gap > 0 && gap < state.minSpacing) {
      score += (state.minSpacing - gap) * state.spacingPenalty;
    }
  }

  if (isMegaTier(deliverable)) {
    const megaKey = `${week}:${dayIndex}`;
    const megaOnDay = state.weekDayMegaCount.get(megaKey) ?? 0;
    if (megaOnDay > 0) score += 5_000;
    score += (state.weekDayHeroCount.get(megaKey) ?? 0) * 45;
  } else if (deliverable.tierRank <= 2) {
    const heroKey = `${week}:${dayIndex}`;
    score += (state.weekDayHeroCount.get(heroKey) ?? 0) * 30;
    score += (state.weekDayMegaCount.get(heroKey) ?? 0) * 120;
  }

  if (deliverable.role === "ugc" && week <= 1) {
    score += 600;
  }
  if (deliverable.role === "ugc" && (state.weekDayMegaCount.get(`${week}:${dayIndex}`) ?? 0) > 0) {
    score += 350;
  }

  const prevDayScore = absoluteDay > 0 ? state.dayImpactScore[absoluteDay - 1] ?? 0 : 0;
  const nextDayScore =
    absoluteDay + 1 < state.dayImpactScore.length
      ? state.dayImpactScore[absoluteDay + 1] ?? 0
      : 0;
  if (prevDayScore >= 70 || nextDayScore >= 70) {
    score += 80;
  }
  if ((state.dayImpactScore[absoluteDay] ?? 0) + impact > 120) {
    score += 200;
  }

  if (dayIndex === 0 || dayIndex === 6) score += 4;

  const { bonus: marketBonus } = marketDayPlacementBonus(absoluteDay, state.marketContext);
  score -= marketBonus;

  return score;
}

function registerPlacement(
  state: DayPlacementState,
  deliverable: SchedulableDeliverable,
  absoluteDay: number,
  week: number,
  dayIndex: number
): void {
  const creatorId = normalizeCreatorId(deliverable.creator.creatorId);
  state.dayLoad[absoluteDay] = (state.dayLoad[absoluteDay] ?? 0) + 1;
  state.dayImpactScore[absoluteDay] =
    (state.dayImpactScore[absoluteDay] ?? 0) + publishingScore(deliverable);
  dayCreatorsOn(state, absoluteDay).add(creatorId);
  state.creatorLastDay.set(creatorId, absoluteDay);
  if (deliverable.tierRank <= 1) {
    const heroKey = `${week}:${dayIndex}`;
    state.weekDayHeroCount.set(heroKey, (state.weekDayHeroCount.get(heroKey) ?? 0) + 1);
  }
  if (isMegaTier(deliverable)) {
    const megaKey = `${week}:${dayIndex}`;
    state.weekDayMegaCount.set(megaKey, (state.weekDayMegaCount.get(megaKey) ?? 0) + 1);
  }
}

/** Strategic day patterns with breathing room — not every day needs content. */
function preferredDayIndexes(
  activationCount: number,
  week: number,
  durationWeeks: number
): number[] {
  const count = Math.max(1, Math.min(activationCount, 6));
  const launchPatterns: Record<number, number[]> = {
    1: [0],
    2: [0, 2],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 3, 4, 6],
    6: [0, 1, 2, 4, 5, 6],
  };
  const sustainPatterns: Record<number, number[]> = {
    1: [2],
    2: [0, 3],
    3: [0, 2, 5],
    4: [0, 2, 3, 5],
    5: [0, 1, 3, 4, 6],
    6: [0, 1, 2, 4, 5, 6],
  };
  const finalPatterns: Record<number, number[]> = {
    1: [3],
    2: [1, 4],
    3: [0, 3, 5],
    4: [0, 2, 4, 6],
    5: [0, 2, 3, 5, 6],
    6: [0, 1, 3, 4, 5, 6],
  };

  if (week === 1) return (launchPatterns[count] ?? launchPatterns[6]!).slice(0, count);
  if (week >= durationWeeks) return (finalPatterns[count] ?? finalPatterns[6]!).slice(0, count);
  return (sustainPatterns[count] ?? sustainPatterns[6]!).slice(0, count);
}

function assignDeliverableToPreferredDay(
  state: DayPlacementState,
  deliverable: SchedulableDeliverable,
  week: number,
  preferredDays: number[],
  totalDays: number
): number | null {
  const weekStart = (week - 1) * 7;
  const candidates: Array<{ absoluteDay: number; score: number; preference: number }> = [];

  for (let preference = 0; preference < preferredDays.length; preference += 1) {
    const dayIndex = preferredDays[preference]!;
    const absoluteDay = weekStart + dayIndex;
    if (absoluteDay >= totalDays) continue;
    const score = scoreDayPlacement(state, deliverable, absoluteDay, week, dayIndex);
    if (!Number.isFinite(score)) continue;
    candidates.push({ absoluteDay, score, preference });
  }

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    if (preferredDays.includes(dayIndex)) continue;
    const absoluteDay = weekStart + dayIndex;
    if (absoluteDay >= totalDays) continue;
    const score = scoreDayPlacement(state, deliverable, absoluteDay, week, dayIndex) + 40;
    if (!Number.isFinite(score)) continue;
    candidates.push({ absoluteDay, score, preference: 99 });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.score - b.score || a.preference - b.preference);
  const best = candidates[0]!;
  const dayIndex = best.absoluteDay % 7;
  registerPlacement(state, deliverable, best.absoluteDay, week, dayIndex);
  return best.absoluteDay;
}

function assignDeliverableToWeekDay(
  state: DayPlacementState,
  deliverable: SchedulableDeliverable,
  week: number,
  totalDays: number
): number | null {
  const weekStart = (week - 1) * 7;
  const candidates: Array<{ absoluteDay: number; score: number }> = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const absoluteDay = weekStart + dayIndex;
    if (absoluteDay >= totalDays) continue;
    const score = scoreDayPlacement(state, deliverable, absoluteDay, week, dayIndex);
    if (!Number.isFinite(score)) continue;
    candidates.push({ absoluteDay, score });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0]!;
  const dayIndex = best.absoluteDay % 7;
  registerPlacement(state, deliverable, best.absoluteDay, week, dayIndex);
  return best.absoluteDay;
}

function assignDeliverableAnyDay(
  state: DayPlacementState,
  deliverable: SchedulableDeliverable,
  totalDays: number
): number | null {
  const candidates: Array<{ absoluteDay: number; score: number }> = [];

  for (let absoluteDay = 0; absoluteDay < totalDays; absoluteDay += 1) {
    const week = Math.floor(absoluteDay / 7) + 1;
    const dayIndex = absoluteDay % 7;
    const score = scoreDayPlacement(state, deliverable, absoluteDay, week, dayIndex);
    if (!Number.isFinite(score)) continue;
    candidates.push({ absoluteDay, score });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0]!;
  const week = Math.floor(best.absoluteDay / 7) + 1;
  const dayIndex = best.absoluteDay % 7;
  registerPlacement(state, deliverable, best.absoluteDay, week, dayIndex);
  return best.absoluteDay;
}

type WeekScoreState = {
  week: number;
  targetScore: number;
  assignedScore: number;
};

function allocateDeliverablesToWeeksByScore(
  ordered: SchedulableDeliverable[],
  durationWeeks: number,
  weekWeights?: number[],
  schedulingContext?: { briefText?: string; campaignObjective?: string }
): Map<number, SchedulableDeliverable[]> {
  const weights =
    weekWeights?.length
      ? normalizeWeekWeights(weekWeights, durationWeeks)
      : normalizeWeekWeights(
          Array.from({ length: durationWeeks }, () => 100 / durationWeeks),
          durationWeeks
        );

  const ugcEarliestWeek = resolveUgcEarliestWeek(
    durationWeeks,
    schedulingContext?.briefText ?? "",
    schedulingContext?.campaignObjective
  );

  const totalScore = ordered.reduce((sum, deliverable) => sum + publishingScore(deliverable), 0);
  const weekStates: WeekScoreState[] = weights.map((weight, index) => ({
    week: index + 1,
    targetScore: (totalScore * weight) / 100,
    assignedScore: 0,
  }));

  const byWeek = new Map<number, SchedulableDeliverable[]>();
  for (let week = 1; week <= durationWeeks; week += 1) {
    byWeek.set(week, []);
  }

  for (const deliverable of ordered) {
    const score = publishingScore(deliverable);
    const eligible = weekStates.filter((entry) => {
      if (deliverable.role === "ugc" && entry.week < ugcEarliestWeek) return false;
      if (deliverable.creatorRound > 0 && entry.week === 1) return false;
      return true;
    });

    if (!eligible.length) continue;

    let bestWeek = eligible[0]!.week;
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (const entry of eligible) {
      const projected = entry.assignedScore + score;
      const targetGap = Math.abs(projected - entry.targetScore);
      const phase = classifyPublishingPhase(deliverable);
      let phasePenalty = 0;
      if (phase === "hero" && entry.week > Math.ceil(durationWeeks * 0.35)) phasePenalty += 80;
      if (phase === "ugc" && entry.week < durationWeeks - 1) phasePenalty += 40;
      if (phase === "reinforcement" && entry.week === 1) phasePenalty += 200;
      const penalty = targetGap + phasePenalty;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestWeek = entry.week;
      }
    }

    const weekState = weekStates.find((entry) => entry.week === bestWeek);
    if (weekState) weekState.assignedScore += score;
    byWeek.get(bestWeek)!.push(deliverable);
  }

  return byWeek;
}

/** Count-based allocation — retained for tests and backward compatibility. */
function allocateDeliverablesToWeeks(
  ordered: SchedulableDeliverable[],
  durationWeeks: number,
  weekWeights?: number[],
  schedulingContext?: { briefText?: string; campaignObjective?: string }
): Map<number, SchedulableDeliverable[]> {
  const weights =
    weekWeights?.length
      ? normalizeWeekWeights(weekWeights, durationWeeks)
      : normalizeWeekWeights(
          Array.from({ length: durationWeeks }, () => 100 / durationWeeks),
          durationWeeks
        );

  const ugcEarliestWeek = resolveUgcEarliestWeek(
    durationWeeks,
    schedulingContext?.briefText ?? "",
    schedulingContext?.campaignObjective
  );

  const ugc = ordered.filter((deliverable) => deliverable.role === "ugc");
  const nonUgc = ordered.filter((deliverable) => deliverable.role !== "ugc");

  const firstRound = nonUgc.filter((deliverable) => deliverable.creatorRound === 0);
  const followUps = nonUgc.filter((deliverable) => deliverable.creatorRound > 0);

  const firstTargets = allocateCountByWeights(firstRound.length, weights);

  const followUpWeights = [...weights];
  if (durationWeeks > 1 && followUpWeights[0]! > 0) {
    followUpWeights[0] = 0;
    const sum = followUpWeights.reduce((total, weight) => total + weight, 0);
    if (sum <= 0) {
      followUpWeights[1] = 100;
    }
  }
  const followTargets = allocateCountByWeights(
    followUps.length,
    normalizeWeekWeights(followUpWeights, durationWeeks)
  );

  const ugcEligibleWeights = weights.map((weight, index) =>
    index + 1 >= ugcEarliestWeek ? weight : 0
  );
  const ugcTargets = allocateCountByWeights(
    ugc.length,
    normalizeWeekWeights(ugcEligibleWeights, durationWeeks)
  );

  const byWeek = new Map<number, SchedulableDeliverable[]>();
  for (let week = 1; week <= durationWeeks; week += 1) {
    byWeek.set(week, []);
  }

  let firstCursor = 0;
  let followCursor = 0;
  let ugcCursor = 0;
  for (let week = 1; week <= durationWeeks; week += 1) {
    const weekIndex = week - 1;
    const firstCount = firstTargets[weekIndex] ?? 0;
    const followCount = followTargets[weekIndex] ?? 0;
    const ugcCount = ugcTargets[weekIndex] ?? 0;
    const weekSlots = [
      ...firstRound.slice(firstCursor, firstCursor + firstCount),
      ...followUps.slice(followCursor, followCursor + followCount),
      ...ugc.slice(ugcCursor, ugcCursor + ugcCount),
    ];
    firstCursor += firstCount;
    followCursor += followCount;
    ugcCursor += ugcCount;
    byWeek.set(week, weekSlots);
  }

  return byWeek;
}

function deliverableTypeMatchKeys(label: string): string[] {
  const normalized = normalizeDeliverableTypeLabel(label);
  const { baseLabel } = parseServiceTypeQuantity(label);
  const base = normalizeDeliverableTypeLabel(baseLabel);
  const unit = normalizeDeliverableTypeLabel(`1× ${baseLabel}`);
  return [...new Set([normalized, base, unit].filter(Boolean))];
}

function labelsMatchDeliverableType(candidate: string, assignmentType: string): boolean {
  const targets = new Set(deliverableTypeMatchKeys(assignmentType));
  return deliverableTypeMatchKeys(candidate).some((key) => targets.has(key));
}

/** Exported for drag/drop assignment regression tests. */
export function deliverableMatchesAssignmentType(
  deliverable: SchedulableDeliverable,
  assignmentType: string
): boolean {
  const candidates = [
    deliverable.serviceType,
    formatActivationServiceLabel(deliverable.serviceType, deliverable.role),
    formatActivationServiceLabel(deliverable.serviceType, deliverable.role, true),
  ];
  if (candidates.some((label) => labelsMatchDeliverableType(label, assignmentType))) {
    return true;
  }
  for (const mirror of deliverable.attachedMirrors ?? []) {
    const mirrorLabels = [
      mirror.serviceType,
      formatActivationServiceLabel(mirror.serviceType, mirror.role, true),
    ];
    if (mirrorLabels.some((label) => labelsMatchDeliverableType(label, assignmentType))) {
      return true;
    }
  }
  for (const companion of deliverable.attachedCompanions ?? []) {
    if (labelsMatchDeliverableType(companion.serviceType, assignmentType)) return true;
  }
  return false;
}

function applyDeliverableAssignments(
  placements: ScheduledDeliverablePlacement[],
  assignments: MediaPlanSlotAssignment[] | undefined,
  deliverables: SchedulableDeliverable[],
  durationWeeks: number
): { placements: ScheduledDeliverablePlacement[]; pinnedSlotIds: Set<string> } {
  if (!assignments?.length) {
    return { placements, pinnedSlotIds: new Set() };
  }

  const byCreator = new Map<string, SchedulableDeliverable[]>();
  for (const deliverable of deliverables) {
    const key = normalizeCreatorId(deliverable.creator.creatorId);
    const list = byCreator.get(key) ?? [];
    list.push(deliverable);
    byCreator.set(key, list);
  }

  const pinned = new Map<string, ScheduledDeliverablePlacement>();
  const pinnedSlotIds = new Set<string>();
  const remaining = [...placements];

  for (const assignment of assignments) {
    const creatorKey = normalizeCreatorId(assignment.creatorId);
    const slots = byCreator.get(creatorKey);
    if (!slots?.length) continue;

    const targetWeek = Math.max(1, Math.min(durationWeeks, assignment.week));
    const targetDayIndex = Math.max(0, Math.min(6, assignment.dayIndex));
    const absoluteDay = (targetWeek - 1) * 7 + targetDayIndex;

    // Untyped ("*") whole-creator pins move every deliverable for that creator.
    // Typed pins match by label, including aggregate "2× …" ↔ expanded "1× …".
    const matchingSlots = assignment.serviceType
      ? slots.filter((slot) => deliverableMatchesAssignmentType(slot, assignment.serviceType!))
      : [...slots].sort((a, b) => a.deliverableIndex - b.deliverableIndex);

    for (const slot of matchingSlots) {
      const existingIndex = remaining.findIndex(
        (placement) => placement.deliverable.slotId === slot.slotId
      );
      if (existingIndex < 0) continue;

      const [removed] = remaining.splice(existingIndex, 1);
      pinnedSlotIds.add(slot.slotId);
      pinned.set(slot.slotId, {
        ...removed!,
        week: targetWeek,
        dayIndex: targetDayIndex,
        absoluteDay,
      });
    }
  }

  return { placements: [...pinned.values(), ...remaining], pinnedSlotIds };
}

/** Score-driven optimizer — continuous campaign presence + strategic day placement. */
export function scheduleDeliverables(input: ScheduleDeliverablesInput): ScheduledDeliverablePlacement[] {
  const durationWeeks = Math.max(1, input.durationWeeks);
  const placements = scheduleDeliverablesInternal(input);
  if (!placements.length) return placements;

  const activations = immutableActivationsFromDeliverables(input.deliverables, {
    weekOneWeight: input.weekWeights?.[0],
    campaignObjective: input.campaignObjective,
  });
  const slate = input.deliverables.map((deliverable) => deliverable.creator);
  const uniqueSlate = [...new Map(slate.map((creator) => [creator.creatorId, creator])).values()];
  const validation = validateScheduledPlacements({
    slate: uniqueSlate,
    placements,
    activations,
    durationWeeks,
    weekWeights: input.weekWeights,
  });

  if (validation.ok || !input.weekWeights?.length) {
    return placements;
  }

  const evenWeights = Array.from({ length: durationWeeks }, () => 100 / durationWeeks);
  const fallback = scheduleDeliverablesInternal({
    ...input,
    weekWeights: evenWeights,
  });
  const fallbackValidation = validateScheduledPlacements({
    slate: uniqueSlate,
    placements: fallback,
    activations,
    durationWeeks,
    weekWeights: evenWeights,
  });
  return fallbackValidation.ok ? fallback : placements;
}

export function validateScheduledPlacements(input: {
  slate: SlateCreator[];
  placements: ScheduledDeliverablePlacement[];
  activations: ImmutableQuotationActivation[];
  durationWeeks: number;
  weekWeights?: number[];
}): MediaPlanValidationResult {
  return validateMediaPlanAgainstQuotation({
    slate: input.slate,
    placements: input.placements,
    activations: input.activations,
    durationWeeks: input.durationWeeks,
    requireContinuousPresence: (input.weekWeights?.length ?? 0) > 1,
  });
}

function scheduleDeliverablesInternal(input: ScheduleDeliverablesInput): ScheduledDeliverablePlacement[] {
  const durationWeeks = Math.max(1, input.durationWeeks);
  const totalDays = durationWeeks * 7;
  const deliverables = input.deliverables;
  if (!deliverables.length) return [];

  const schedulingContext = {
    campaignObjective: input.campaignObjective,
    targetPlatforms: input.targetPlatforms,
    priorityWeights: input.priorityWeights,
    weekOneWeight: input.weekWeights?.[0],
  };

  const ordered = orderDeliverablesForOptimization(deliverables, schedulingContext);
  const byWeek = allocateDeliverablesThroughCampaignJourney(ordered, durationWeeks, {
    weekWeights: input.weekWeights,
    briefText: input.briefText,
    campaignObjective: input.campaignObjective,
    targetPlatforms: input.targetPlatforms,
    priorityWeights: input.priorityWeights,
    marketContext: input.marketContext,
  });
  const uniqueCreators = new Set(deliverables.map((d) => normalizeCreatorId(d.creator.creatorId))).size;
  const minSpacing = resolveMinSpacingDays(totalDays, deliverables.length, uniqueCreators);

  const placements: ScheduledDeliverablePlacement[] = [];
  const state = createPlacementState(totalDays, minSpacing, input.marketContext);

  for (let week = 1; week <= durationWeeks; week += 1) {
    const weekPhase = dominantMomentForWeek(week, durationWeeks);
    const weekDeliverables = sortDeliverablesForPhaseSlotAssignment(
      [...(byWeek.get(week) ?? [])],
      weekPhase,
      {
        campaignObjective: input.campaignObjective,
        targetPlatforms: input.targetPlatforms,
        priorityWeights: input.priorityWeights,
      }
    );

    let slotRank = 0;
    const preferredDays = preferredDayIndexes(weekDeliverables.length, week, durationWeeks);
    for (const { deliverable, result } of weekDeliverables) {
      slotRank += 1;
      let absoluteDay: number | null = null;

      if (week === 1 && isMegaTier(deliverable) && !(state.dayLoad[0] ?? 0)) {
        const launchScore = scoreDayPlacement(state, deliverable, 0, 1, 0);
        if (Number.isFinite(launchScore)) {
          registerPlacement(state, deliverable, 0, 1, 0);
          absoluteDay = 0;
        }
      }

      if (absoluteDay == null) {
        absoluteDay = assignDeliverableToPreferredDay(
          state,
          deliverable,
          week,
          preferredDays,
          totalDays
        );
      }

      if (absoluteDay == null) {
        state.allowConsecutive = true;
        absoluteDay = assignDeliverableToWeekDay(state, deliverable, week, totalDays);
      }

      if (absoluteDay == null) {
        state.spacingPenalty = 20;
        absoluteDay = assignDeliverableAnyDay(state, deliverable, totalDays);
      }

      if (absoluteDay == null) continue;

      const placementDate = new Date(input.marketContext?.campaignStartDate ?? new Date());
      if (input.marketContext) {
        placementDate.setDate(
          placementDate.getDate() + absoluteDay
        );
      }
      const marketDayScore = input.marketContext
        ? scoreMarketOpportunityForDate(
            placementDate,
            input.marketContext.windows,
            input.marketContext.category,
            input.marketContext.config
          )
        : undefined;
      const marketWeekReasons = marketReasonsForPlacement(week, input.marketContext);

      placements.push({
        deliverable,
        week: Math.floor(absoluteDay / 7) + 1,
        dayIndex: absoluteDay % 7,
        absoluteDay,
        schedulingRationale: buildSchedulingRationale(
          deliverable,
          result,
          weekPhase,
          slotRank,
          marketDayScore
            ? {
                score: marketDayScore.score,
                reasons: [...marketWeekReasons, ...marketDayScore.reasons],
              }
            : undefined
        ),
      });
    }
  }

  const { placements: reassigned, pinnedSlotIds } = applyDeliverableAssignments(
    placements,
    input.assignments,
    deliverables,
    durationWeeks
  );

  if (!input.assignments?.length) return reassigned;

  const final: ScheduledDeliverablePlacement[] = [];
  const finalState = createPlacementState(totalDays, minSpacing, input.marketContext);

  for (const placement of reassigned.sort((a, b) => a.absoluteDay - b.absoluteDay)) {
    const creatorId = normalizeCreatorId(placement.deliverable.creator.creatorId);
    const onDay = dayCreatorsOn(finalState, placement.absoluteDay);
    const isPinned = pinnedSlotIds.has(placement.deliverable.slotId);

    if (!isPinned && onDay.has(creatorId)) {
      const relocated = assignDeliverableAnyDay(finalState, placement.deliverable, totalDays);
      if (relocated == null) continue;
      final.push({
        deliverable: placement.deliverable,
        week: Math.floor(relocated / 7) + 1,
        dayIndex: relocated % 7,
        absoluteDay: relocated,
      });
      continue;
    }

    registerPlacement(
      finalState,
      placement.deliverable,
      placement.absoluteDay,
      placement.week,
      placement.dayIndex
    );
    final.push(placement);
  }

  return final;
}

export type DeliverableDayBucket = {
  placements: ScheduledDeliverablePlacement[];
};

/** Bucket scheduled deliverables by absolute day index (length = durationWeeks × 7). */
export function distributeDeliverablesToDays(
  slate: SlateCreator[],
  totalDays: number,
  options: {
    durationWeeks: number;
    weekWeights?: number[];
    assignments?: MediaPlanSlotAssignment[];
    platforms?: string[];
    briefText?: string;
    campaignObjective?: string;
    priorityWeights?: Partial<MediaPlanPriorityWeights>;
    marketContext?: MarketSchedulingContext;
  }
): DeliverableDayBucket[] {
  const durationWeeks = Math.max(1, options.durationWeeks);
  const deliverables = expandSchedulableDeliverables(slate, options.platforms ?? ["Instagram"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks,
    weekWeights: options.weekWeights,
    assignments: options.assignments,
    briefText: options.briefText,
    campaignObjective: options.campaignObjective,
    targetPlatforms: options.platforms,
    priorityWeights: options.priorityWeights,
    marketContext: options.marketContext,
  });

  const buckets: DeliverableDayBucket[] = Array.from({ length: totalDays }, () => ({
    placements: [],
  }));

  for (const placement of placements) {
    if (placement.absoluteDay >= 0 && placement.absoluteDay < totalDays) {
      buckets[placement.absoluteDay]!.placements.push(placement);
    }
  }

  return buckets;
}

/** Count deliverables placed in each campaign week. */
export function countDeliverablesPerWeek(
  slate: SlateCreator[],
  durationWeeks: number,
  options?: {
    weekWeights?: number[];
    assignments?: MediaPlanSlotAssignment[];
    platforms?: string[];
    briefText?: string;
    campaignObjective?: string;
  }
): number[] {
  const deliverables = expandSchedulableDeliverables(slate, options?.platforms ?? ["Instagram"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks,
    weekWeights: options?.weekWeights,
    assignments: options?.assignments,
    briefText: options?.briefText,
    campaignObjective: options?.campaignObjective,
  });

  const counts = Array.from({ length: durationWeeks }, () => 0);
  for (const placement of placements) {
    const weekIndex = placement.week - 1;
    if (weekIndex >= 0 && weekIndex < durationWeeks) {
      counts[weekIndex]! += 1;
    }
  }
  return counts;
}

/** Total publishing impact score placed in each campaign week. */
export function publishingScorePerWeek(
  slate: SlateCreator[],
  durationWeeks: number,
  options?: {
    weekWeights?: number[];
    assignments?: MediaPlanSlotAssignment[];
    platforms?: string[];
    briefText?: string;
    campaignObjective?: string;
  }
): number[] {
  const deliverables = expandSchedulableDeliverables(slate, options?.platforms ?? ["Instagram"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks,
    weekWeights: options?.weekWeights,
    assignments: options?.assignments,
    briefText: options?.briefText,
    campaignObjective: options?.campaignObjective,
  });

  const scores = Array.from({ length: durationWeeks }, () => 0);
  for (const placement of placements) {
    const weekIndex = placement.week - 1;
    if (weekIndex >= 0 && weekIndex < durationWeeks) {
      scores[weekIndex]! += publishingScore(placement.deliverable);
    }
  }
  return scores;
}

/** Export count-based week allocation for regression tests. */
export function allocateDeliverablesToWeeksByCount(
  ordered: SchedulableDeliverable[],
  durationWeeks: number,
  weekWeights?: number[],
  schedulingContext?: { briefText?: string; campaignObjective?: string }
): Map<number, SchedulableDeliverable[]> {
  return allocateDeliverablesToWeeks(ordered, durationWeeks, weekWeights, schedulingContext);
}
