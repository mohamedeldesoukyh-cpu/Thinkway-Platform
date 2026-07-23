/**
 * Campaign journey allocator — moments first, then weeks, then days.
 *
 * Week weights express strategic emphasis, not permission to compress
 * the campaign into the earliest week.
 */

import { normalizeWeekWeights } from "./media-plan-schedule";
import type { CampaignMoment } from "./media-plan-moments";
import { eligibleWeeksForMoment } from "./media-plan-moments";
import { resolveUgcEarliestWeek } from "./media-plan-deliverable-classification";
import type { SchedulableDeliverable } from "./media-plan-scheduler-types";
import { compareDeliverablesByPriority } from "./media-plan-creator-priority";
import type { MediaPlanPriorityWeights } from "./media-plan-priority-weights";
import {
  resolvePreferredMoments,
  type ImmutableQuotationActivation,
} from "./media-plan-quotation-activations";
import type { MarketSchedulingContext } from "@/features/market-intelligence";
import { marketWeekAllocationBonus } from "@/features/market-intelligence/market-intelligence-engine";

type PublishingPhase = "hero" | "supporting" | "reinforcement" | "community" | "ugc";

function classifyPublishingPhase(deliverable: SchedulableDeliverable): PublishingPhase {
  if (deliverable.role === "ugc") return "ugc";
  if (deliverable.creatorRound > 0) return "reinforcement";
  if (deliverable.tierRank <= 1) return "hero";
  if (deliverable.tierRank <= 2) return "supporting";
  return "community";
}

function publishingInfluenceScore(deliverable: SchedulableDeliverable): number {
  if (!deliverable.countsAsActivation || deliverable.role === "mirror") return 0;
  if (deliverable.role === "ugc") return 40;
  const tier = deliverable.creator.tier?.trim().toLowerCase() ?? "";
  if (tier === "celebrity" || tier === "mega") return 100;
  if (tier === "macro") return 85;
  if (tier === "mid" || tier === "mid-tier") return 70;
  if (tier === "micro") return 55;
  return 60;
}

function primaryMomentForDeliverable(
  deliverable: SchedulableDeliverable,
  options?: { weekOneWeight?: number; campaignObjective?: string }
): CampaignMoment {
  const preferred = resolvePreferredMoments({
    role: deliverable.role,
    creatorRound: deliverable.creatorRound,
    tierRank: deliverable.tierRank,
    tier: deliverable.creator.tier,
    weekOneWeight: options?.weekOneWeight,
    campaignObjective: options?.campaignObjective,
  });
  return preferred[0] ?? "momentum";
}

export function computeContinuousWeekTargets(
  totalActivations: number,
  durationWeeks: number
): number[] {
  if (durationWeeks <= 0) return [];
  if (totalActivations <= 0) return Array.from({ length: durationWeeks }, () => 0);

  const targets = Array.from({ length: durationWeeks }, () => 0);

  if (totalActivations < durationWeeks) {
    const targets = Array.from({ length: durationWeeks }, () => 0);
    const launchWeek = 1;
    const closeWeek = durationWeeks;
    const middleWeek = Math.ceil(durationWeeks / 2);
    const priorityWeeks = [launchWeek, middleWeek, closeWeek];
    let cursor = 0;
    for (const week of priorityWeeks) {
      if (cursor >= totalActivations) break;
      targets[week - 1]! += 1;
      cursor += 1;
    }
    for (let week = 1; week <= durationWeeks && cursor < totalActivations; week += 1) {
      if (targets[week - 1]! > 0) continue;
      targets[week - 1]! += 1;
      cursor += 1;
    }
    return targets;
  }

  const base = Math.floor(totalActivations / durationWeeks);
  let remainder = totalActivations % durationWeeks;
  for (let week = 0; week < durationWeeks; week += 1) targets[week] = base;
  for (let week = 0; week < durationWeeks && remainder > 0; week += 1) {
    targets[week]! += 1;
    remainder -= 1;
  }
  return targets;
}

function eligibleWeeksForDeliverable(
  deliverable: SchedulableDeliverable,
  durationWeeks: number,
  ugcEarliestWeek: number,
  options?: { weekOneWeight?: number; campaignObjective?: string }
): number[] {
  const moment = primaryMomentForDeliverable(deliverable, options);
  const eligible = eligibleWeeksForMoment(moment, durationWeeks, ugcEarliestWeek);
  if (deliverable.role === "ugc") return eligible.filter((week) => week >= ugcEarliestWeek);
  if (deliverable.creatorRound > 0) return eligible.filter((week) => week > 1);
  return eligible;
}

function weekEmphasisScore(
  week: number,
  deliverable: SchedulableDeliverable,
  weights: number[],
  durationWeeks: number
): number {
  const weight = weights[week - 1] ?? 0;
  const phase = classifyPublishingPhase(deliverable);
  let score = weight * 0.6;

  if (phase === "hero") {
    if (week === 1) score += 35;
    if (week === 2 && durationWeeks >= 3) score += 18;
    if (week > Math.ceil(durationWeeks * 0.45)) score -= 45;
  }
  if (phase === "supporting" && week >= 2 && week <= Math.ceil(durationWeeks * 0.65)) score += 20;
  if (phase === "community" && week >= Math.ceil(durationWeeks * 0.4)) score += 15;
  if (phase === "reinforcement") {
    if (week === 1) score -= 60;
    if (week >= 2) score += 12;
  }
  if (phase === "ugc" && week >= durationWeeks - 1) score += 30;

  return score;
}

function pickWeekForDeliverable(
  deliverable: SchedulableDeliverable,
  durationWeeks: number,
  weekTargets: number[],
  weekAssigned: number[],
  weights: number[],
  ugcEarliestWeek: number,
  options?: {
    weekOneWeight?: number;
    campaignObjective?: string;
    marketContext?: MarketSchedulingContext;
  }
): number {
  const eligible = eligibleWeeksForDeliverable(deliverable, durationWeeks, ugcEarliestWeek, options);
  const underCapacity = eligible.filter((week) => weekAssigned[week - 1]! < weekTargets[week - 1]!);
  const candidates = underCapacity.length ? underCapacity : eligible;

  let bestWeek = candidates[0] ?? 1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const week of candidates) {
    const assigned = weekAssigned[week - 1]!;
    const target = weekTargets[week - 1]!;
    const loadPenalty = assigned * 28;
    const overTargetPenalty = assigned >= target ? 80 : 0;
    const underTargetBonus = assigned < target ? 25 : 0;
    const emptyWeekBonus = assigned === 0 ? 40 : 0;
    const heroLaunchBonus =
      week === 1 && deliverable.tierRank <= 1 && deliverable.creatorRound === 0 ? 50 : 0;
    const emphasis = weekEmphasisScore(week, deliverable, weights, durationWeeks);
    const influence = publishingInfluenceScore(deliverable) * 0.05;
    const { bonus: marketBonus } = marketWeekAllocationBonus(week, options?.marketContext);
    const total =
      emphasis + emptyWeekBonus + underTargetBonus + heroLaunchBonus + influence + marketBonus - loadPenalty - overTargetPenalty;
    if (total > bestScore) {
      bestScore = total;
      bestWeek = week;
    }
  }

  return bestWeek;
}

function rebalanceEmptyWeeks(
  byWeek: Map<number, SchedulableDeliverable[]>,
  durationWeeks: number,
  weekAssigned: number[]
): void {
  for (let week = 1; week <= durationWeeks; week += 1) {
    if ((byWeek.get(week) ?? []).length > 0) continue;

    let donorWeek = -1;
    let donorIndex = -1;
    let donorLoad = 0;

    for (let candidate = 1; candidate <= durationWeeks; candidate += 1) {
      const slots = byWeek.get(candidate) ?? [];
      if (slots.length <= 1) continue;
      const movableIndex = slots.findIndex(
        (deliverable) => deliverable.creatorRound === 0 && deliverable.role !== "ugc"
      );
      if (movableIndex < 0) continue;
      if (slots.length > donorLoad) {
        donorLoad = slots.length;
        donorWeek = candidate;
        donorIndex = movableIndex;
      }
    }

    if (donorWeek < 0 || donorIndex < 0) continue;
    const donorSlots = byWeek.get(donorWeek) ?? [];
    const [moved] = donorSlots.splice(donorIndex, 1);
    if (!moved) continue;
    byWeek.get(week)!.push(moved);
    weekAssigned[donorWeek - 1]! -= 1;
    weekAssigned[week - 1]! += 1;
  }
}


export function allocateDeliverablesThroughCampaignJourney(
  deliverables: SchedulableDeliverable[],
  durationWeeks: number,
  options?: {
    weekWeights?: number[];
    briefText?: string;
    campaignObjective?: string;
    targetPlatforms?: string[];
    priorityWeights?: Partial<MediaPlanPriorityWeights>;
    marketContext?: MarketSchedulingContext;
  }
): Map<number, SchedulableDeliverable[]> {
  const weights =
    options?.weekWeights?.length
      ? normalizeWeekWeights(options.weekWeights, durationWeeks)
      : normalizeWeekWeights(
          Array.from({ length: durationWeeks }, () => 100 / durationWeeks),
          durationWeeks
        );

  const ugcEarliestWeek = resolveUgcEarliestWeek(
    durationWeeks,
    options?.briefText ?? "",
    options?.campaignObjective
  );

  const weekTargets = computeContinuousWeekTargets(deliverables.length, durationWeeks);
  const weekAssigned = Array.from({ length: durationWeeks }, () => 0);
  const byWeek = new Map<number, SchedulableDeliverable[]>();
  for (let week = 1; week <= durationWeeks; week += 1) byWeek.set(week, []);

  const journeyOptions = {
    weekOneWeight: weights[0],
    campaignObjective: options?.campaignObjective,
    marketContext: options?.marketContext,
  };

  const sorted = [...deliverables].sort((a, b) =>
    compareDeliverablesByPriority(a, b, {
      campaignObjective: options?.campaignObjective,
      targetPlatforms: options?.targetPlatforms,
      priorityWeights: options?.priorityWeights,
    })
  );

  for (const deliverable of sorted) {
    const week = pickWeekForDeliverable(
      deliverable,
      durationWeeks,
      weekTargets,
      weekAssigned,
      weights,
      ugcEarliestWeek,
      journeyOptions
    );
    byWeek.get(week)!.push(deliverable);
    weekAssigned[week - 1]! += 1;
  }

  if (deliverables.length >= durationWeeks) {
    rebalanceEmptyWeeks(byWeek, durationWeeks, weekAssigned);
  }

  return byWeek;
}

export function immutableActivationsFromDeliverables(
  deliverables: SchedulableDeliverable[],
  options?: { weekOneWeight?: number; campaignObjective?: string }
): ImmutableQuotationActivation[] {
  return deliverables.map((unit) => ({
    activationId: unit.slotId,
    creator: unit.creator,
    primaryServiceType: unit.serviceType,
    platform: unit.platform,
    tierRank: unit.tierRank,
    role: unit.role,
    creatorRound: unit.creatorRound,
    deliverableIndex: unit.deliverableIndex,
    deliverableTotal: unit.deliverableTotal,
    companionServiceTypes: (unit.attachedCompanions ?? []).map((entry) => entry.serviceType),
    mirrorServiceTypes: (unit.attachedMirrors ?? []).map((entry) => entry.serviceType),
    influenceScore: publishingInfluenceScore(unit),
    preferredMoments: resolvePreferredMoments({
      role: unit.role,
      creatorRound: unit.creatorRound,
      tierRank: unit.tierRank,
      tier: unit.creator.tier,
      weekOneWeight: options?.weekOneWeight,
      campaignObjective: options?.campaignObjective,
    }),
  }));
}
