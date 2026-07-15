import type { SlateCreator } from "./output-inputs";
import {
  allocateCountByWeights,
  normalizeWeekWeights,
  type MediaPlanSlotAssignment,
} from "./media-plan-schedule";
import {
  classifyDeliverableRole,
  collapseMirrorsToActivations,
  type DeliverableRole,
  resolveUgcEarliestWeek,
} from "./media-plan-deliverable-classification";

const TIER_PRIORITY: Record<string, number> = {
  celebrity: 0,
  mega: 0,
  macro: 1,
  "mid-tier": 2,
  mid: 2,
  micro: 3,
  nano: 4,
};

export type SchedulableDeliverable = {
  slotId: string;
  creator: SlateCreator;
  /** Single-unit service label shown on the calendar card. */
  serviceType: string;
  platform: string;
  /** 1-based index within this creator + base deliverable type. */
  deliverableIndex: number;
  deliverableTotal: number;
  /** Round index for week allocation — 0 = first post, 1 = second, etc. */
  creatorRound: number;
  tierRank: number;
  role: DeliverableRole;
  /** False for mirror lines bundled onto a primary activation. */
  countsAsActivation: boolean;
  /** Mirror deliverables scheduled on the same day as this activation. */
  attachedMirrors: SchedulableDeliverable[];
};

export type ScheduledDeliverablePlacement = {
  deliverable: SchedulableDeliverable;
  week: number;
  dayIndex: number;
  absoluteDay: number;
};

export type ScheduleDeliverablesInput = {
  deliverables: SchedulableDeliverable[];
  durationWeeks: number;
  weekWeights?: number[];
  assignments?: MediaPlanSlotAssignment[];
  briefText?: string;
  campaignObjective?: string;
};

function normalizeCreatorId(id: string): string {
  return id.trim().toLowerCase();
}

function tierRank(tier?: string): number {
  if (!tier) return 5;
  return TIER_PRIORITY[tier.trim().toLowerCase()] ?? 5;
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
  return fallback;
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

/** Expand quotation lines into schedulable activations (mirrors collapsed onto originals). */
export function expandSchedulableDeliverables(
  slate: SlateCreator[],
  platforms: string[]
): SchedulableDeliverable[] {
  const raw = expandRawSchedulableDeliverables(slate, platforms);
  return collapseMirrorsToActivations(raw).activations;
}

/** Activation count — mirrors excluded. */
export function countSchedulableActivations(slate: SlateCreator[], platforms: string[]): number {
  return expandSchedulableDeliverables(slate, platforms).length;
}

function sortCreatorsByTier(creators: SlateCreator[]): SlateCreator[] {
  return [...creators].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

/** Interleave first/second/… deliverables across creators for launch-heavy week allocation. */
export function orderDeliverablesForWeekAllocation(
  deliverables: SchedulableDeliverable[]
): SchedulableDeliverable[] {
  const byCreator = new Map<string, SchedulableDeliverable[]>();
  for (const deliverable of deliverables) {
    const key = normalizeCreatorId(deliverable.creator.creatorId);
    const list = byCreator.get(key) ?? [];
    list.push(deliverable);
    byCreator.set(key, list);
  }

  const creators = sortCreatorsByTier(
    [...byCreator.values()].map((slots) => slots[0]!.creator)
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

function resolveMinSpacingDays(
  totalDays: number,
  deliverableCount: number,
  creatorCount: number
): number {
  const avgPerCreator = deliverableCount / Math.max(1, creatorCount);
  if (avgPerCreator <= 1.01) return 5;
  const scaled = Math.floor(totalDays / (avgPerCreator + 1));
  return Math.max(5, Math.min(10, scaled));
}

type DayPlacementState = {
  dayLoad: number[];
  dayCreators: Map<number, Set<string>>;
  creatorLastDay: Map<string, number>;
  weekDayHeroCount: Map<string, number>;
  minSpacing: number;
  allowConsecutive: boolean;
  spacingPenalty: number;
};

function createPlacementState(totalDays: number, minSpacing: number): DayPlacementState {
  return {
    dayLoad: Array.from({ length: totalDays }, () => 0),
    dayCreators: new Map(),
    creatorLastDay: new Map(),
    weekDayHeroCount: new Map(),
    minSpacing,
    allowConsecutive: false,
    spacingPenalty: 50,
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

  let score = (state.dayLoad[absoluteDay] ?? 0) * 12;

  const lastDay = state.creatorLastDay.get(creatorId);
  if (lastDay != null) {
    const gap = absoluteDay - lastDay;
    if (!state.allowConsecutive && Math.abs(gap) === 1) {
      score += 1_000;
    }
    if (gap > 0 && gap < state.minSpacing) {
      score += (state.minSpacing - gap) * state.spacingPenalty;
    }
  }

  if (deliverable.tierRank <= 1) {
    const heroKey = `${week}:${dayIndex}`;
    score += (state.weekDayHeroCount.get(heroKey) ?? 0) * 35;
  }

  if (deliverable.role === "ugc" && week <= 1) {
    score += 500;
  }
  if (deliverable.role === "ugc" && (state.weekDayHeroCount.get(`${week}:${dayIndex}`) ?? 0) > 0) {
    score += 250;
  }

  if (dayIndex === 0 || dayIndex === 6) score += 3;

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
  dayCreatorsOn(state, absoluteDay).add(creatorId);
  state.creatorLastDay.set(creatorId, absoluteDay);
  if (deliverable.tierRank <= 1) {
    const heroKey = `${week}:${dayIndex}`;
    state.weekDayHeroCount.set(heroKey, (state.weekDayHeroCount.get(heroKey) ?? 0) + 1);
  }
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

function applyDeliverableAssignments(
  placements: ScheduledDeliverablePlacement[],
  assignments: MediaPlanSlotAssignment[] | undefined,
  deliverables: SchedulableDeliverable[],
  durationWeeks: number
): ScheduledDeliverablePlacement[] {
  if (!assignments?.length) return placements;

  const byCreator = new Map<string, SchedulableDeliverable[]>();
  for (const deliverable of deliverables) {
    const key = normalizeCreatorId(deliverable.creator.creatorId);
    const list = byCreator.get(key) ?? [];
    list.push(deliverable);
    byCreator.set(key, list);
  }

  const pinned = new Map<string, ScheduledDeliverablePlacement>();
  const remaining = [...placements];

  for (const assignment of assignments) {
    const creatorKey = normalizeCreatorId(assignment.creatorId);
    const slots = byCreator.get(creatorKey);
    if (!slots?.length) continue;

    const targetWeek = Math.max(1, Math.min(durationWeeks, assignment.week));
    const targetDayIndex = Math.max(0, Math.min(6, assignment.dayIndex));
    const absoluteDay = (targetWeek - 1) * 7 + targetDayIndex;

    const primarySlot = [...slots].sort((a, b) => a.deliverableIndex - b.deliverableIndex)[0]!;
    const existingIndex = remaining.findIndex(
      (placement) => placement.deliverable.slotId === primarySlot.slotId
    );
    if (existingIndex < 0) continue;

    const [removed] = remaining.splice(existingIndex, 1);
    pinned.set(creatorKey, {
      ...removed!,
      week: targetWeek,
      dayIndex: targetDayIndex,
      absoluteDay,
    });
  }

  return [...pinned.values(), ...remaining];
}

/** Core scheduler — strategy weights drive week allocation; spacing rules drive day placement. */
export function scheduleDeliverables(input: ScheduleDeliverablesInput): ScheduledDeliverablePlacement[] {
  const durationWeeks = Math.max(1, input.durationWeeks);
  const totalDays = durationWeeks * 7;
  const deliverables = input.deliverables;
  if (!deliverables.length) return [];

  const ordered = orderDeliverablesForWeekAllocation(deliverables);
  const byWeek = allocateDeliverablesToWeeks(ordered, durationWeeks, input.weekWeights, {
    briefText: input.briefText,
    campaignObjective: input.campaignObjective,
  });
  const uniqueCreators = new Set(deliverables.map((d) => normalizeCreatorId(d.creator.creatorId))).size;
  const minSpacing = resolveMinSpacingDays(totalDays, deliverables.length, uniqueCreators);

  const placements: ScheduledDeliverablePlacement[] = [];
  const state = createPlacementState(totalDays, minSpacing);

  for (let week = 1; week <= durationWeeks; week += 1) {
    const weekDeliverables = [...(byWeek.get(week) ?? [])].sort(
      (a, b) => a.tierRank - b.tierRank || a.creatorRound - b.creatorRound
    );

    for (const deliverable of weekDeliverables) {
      let absoluteDay = assignDeliverableToWeekDay(state, deliverable, week, totalDays);

      if (absoluteDay == null) {
        state.allowConsecutive = true;
        absoluteDay = assignDeliverableToWeekDay(state, deliverable, week, totalDays);
      }

      if (absoluteDay == null) {
        state.spacingPenalty = 15;
        absoluteDay = assignDeliverableAnyDay(state, deliverable, totalDays);
      }

      if (absoluteDay == null) continue;

      placements.push({
        deliverable,
        week: Math.floor(absoluteDay / 7) + 1,
        dayIndex: absoluteDay % 7,
        absoluteDay,
      });
    }
  }

  const reassigned = applyDeliverableAssignments(
    placements,
    input.assignments,
    deliverables,
    durationWeeks
  );

  if (!input.assignments?.length) return reassigned;

  const final: ScheduledDeliverablePlacement[] = [];
  const finalState = createPlacementState(totalDays, minSpacing);

  for (const placement of reassigned.sort((a, b) => a.absoluteDay - b.absoluteDay)) {
    const creatorId = normalizeCreatorId(placement.deliverable.creator.creatorId);
    const onDay = dayCreatorsOn(finalState, placement.absoluteDay);
    if (onDay.has(creatorId)) {
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
