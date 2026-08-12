import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { MediaPlanPriorityWeights } from "./media-plan-priority-weights";
import type { MediaPlanMarketIntelligenceMeta } from "@/features/market-intelligence/market-intelligence-config";
import { resolveSlate, type SlateCreator } from "./output-inputs";
import { normalizeCreatorMatchKey } from "./hydration/quotation-service-types";
import {
  deriveWeekWeightsFromBrief,
  resolveBriefTextForScheduling,
  resolveMediaPlanWeekWeights,
} from "./brief-media-plan-schedule";
import { countDeliverablesPerWeek } from "./media-plan-scheduler";

/** Copilot-controlled publishing distribution — does not move campaign start date. */
export type MediaPlanScheduleMeta = {
  /** Week weights (sum ~100) for creator distribution across the calendar. */
  weekWeights?: number[];
  /** Explicit creator slot overrides (week 1-based, dayIndex 0=Saturday). */
  assignments?: MediaPlanSlotAssignment[];
  /** Optional per-campaign creator-priority weight overrides (merged onto defaults). */
  priorityWeights?: Partial<MediaPlanPriorityWeights>;
  /** Market intelligence toggles — all factors enabled by default. */
  marketIntelligence?: MediaPlanMarketIntelligenceMeta;
};

export type MediaPlanSlotAssignment = {
  creatorId: string;
  week: number;
  dayIndex: number;
  /** When set, pins this specific deliverable type; omit for legacy whole-creator moves. */
  serviceType?: string;
  /** Assignment PK — authoritative operational join (Release 2.1). */
  campaignLineId?: string | null;
  assignmentDeliverableId?: string | null;
  assignmentPostScheduleId?: string | null;
};

export function normalizeDeliverableTypeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function assignmentKey(assignment: MediaPlanSlotAssignment): string {
  const creator = assignment.creatorId.trim().toLowerCase();
  const type = assignment.serviceType
    ? normalizeDeliverableTypeLabel(assignment.serviceType)
    : "*";
  return `${creator}::${type}`;
}

export function mediaPlanScheduleFromMeta(
  meta: CampaignObject["meta"] | undefined
): MediaPlanScheduleMeta | undefined {
  return meta?.mediaPlanSchedule;
}

export function normalizeWeekWeights(weights: number[], weekCount: number): number[] {
  const trimmed = weights.slice(0, weekCount);
  while (trimmed.length < weekCount) trimmed.push(0);
  const sum = trimmed.reduce((total, weight) => total + Math.max(0, weight), 0);
  if (sum <= 0) {
    const even = Math.floor(100 / weekCount);
    const evened = Array.from({ length: weekCount }, () => even);
    evened[weekCount - 1]! += 100 - even * weekCount;
    return evened;
  }
  const scaled = trimmed.map((weight) => Math.round((Math.max(0, weight) / sum) * 100));
  const diff = 100 - scaled.reduce((total, weight) => total + weight, 0);
  scaled[weekCount - 1]! += diff;
  return scaled;
}

/** Allocate N items across buckets using weight percentages. */
export function allocateCountByWeights(total: number, weights: number[]): number[] {
  if (total <= 0) return weights.map(() => 0);
  const normalized = normalizeWeekWeights(weights, weights.length);
  const raw = normalized.map((weight) => (total * weight) / 100);
  const counts = raw.map((value) => Math.floor(value));
  let remaining = total - counts.reduce((sum, count) => sum + count, 0);
  const remainders = raw
    .map((value, index) => ({ index, remainder: value - counts[index]! }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const entry of remainders) {
    if (remaining <= 0) break;
    counts[entry.index]! += 1;
    remaining -= 1;
  }
  return counts;
}

function normalizeCreatorId(id: string): string {
  return id.trim().toLowerCase();
}

function findSlateCreatorByName(slate: SlateCreator[], name: string): SlateCreator | undefined {
  const key = normalizeCreatorMatchKey(name);
  if (!key) return undefined;
  return slate.find((creator) => {
    const display = normalizeCreatorMatchKey(creator.displayName);
    const handle = creator.handle?.replace(/^@/, "").trim().toLowerCase();
    return (
      key === display ||
      display.startsWith(key) ||
      key.startsWith(display) ||
      (handle ? key === handle || handle.includes(key) : false)
    );
  });
}

/**
 * Schedule week bound must cover the visible calendar, not only brief facts.
 * Facts `durationWeeks` can be shorter than `calendarWeeks` / tip week rows.
 */
export function resolveScheduleDurationWeeks(
  campaignObject: CampaignObject,
  existing?: MediaPlanScheduleMeta
): number {
  const facts = getCampaignFacts(campaignObject);
  const factsWeeks = Math.max(1, facts?.durationWeeks ?? 4);

  let planWeeks = 0;
  const planData = campaignObject.meta?.campaignOutputs?.media_plan?.content?.data;
  if (planData && typeof planData === "object") {
    const data = planData as {
      calendarWeeks?: unknown;
      durationWeeks?: unknown;
      weeks?: unknown;
    };
    if (typeof data.calendarWeeks === "number" && Number.isFinite(data.calendarWeeks)) {
      planWeeks = Math.max(planWeeks, data.calendarWeeks);
    }
    if (typeof data.durationWeeks === "number" && Number.isFinite(data.durationWeeks)) {
      planWeeks = Math.max(planWeeks, data.durationWeeks);
    }
    if (Array.isArray(data.weeks)) {
      planWeeks = Math.max(planWeeks, data.weeks.length);
    }
  }

  const assignmentMax = Math.max(
    0,
    ...((existing ?? mediaPlanScheduleFromMeta(campaignObject.meta))?.assignments ?? []).map(
      (assignment) => assignment.week
    )
  );

  return Math.max(1, Math.min(52, Math.max(factsWeeks, planWeeks, assignmentMax)));
}

/**
 * Resolve move targets against the slate.
 * Remaining cards often carry Assignment influencer IDs while the slate still
 * uses quotation / Studio creator IDs — fall back to display name, then synthesize.
 */
function resolveCreatorsForMove(
  slate: SlateCreator[],
  move: NonNullable<RescheduleMediaPlanInput["moveCreators"]>[number]
): SlateCreator[] {
  const resolved = new Map<string, SlateCreator>();

  for (const creatorId of move.creatorIds ?? []) {
    const creator = slate.find(
      (entry) => normalizeCreatorId(entry.creatorId) === normalizeCreatorId(creatorId)
    );
    if (creator) resolved.set(normalizeCreatorId(creator.creatorId), creator);
  }

  for (const name of move.names ?? []) {
    const creator = findSlateCreatorByName(slate, name);
    if (creator) resolved.set(normalizeCreatorId(creator.creatorId), creator);
  }

  if (resolved.size > 0) return [...resolved.values()];

  const fallbackId = move.creatorIds?.[0]?.trim();
  const fallbackName = move.names?.find((name) => name.trim())?.trim();
  if (!fallbackId && !fallbackName) return [];

  const syntheticId = fallbackId || fallbackName!;
  return [
    {
      creatorId: syntheticId,
      displayName: fallbackName || fallbackId || syntheticId,
    },
  ];
}

export type RescheduleMediaPlanInput = {
  weekWeights?: number[];
  moveCreators?: Array<{
    names?: string[];
    /** Direct slate creator ids — used by interactive schedule UI. */
    creatorIds?: string[];
    fromWeek?: number;
    fromDayIndex?: number;
    toWeek?: number;
    toDayIndex?: number;
    /** Deliverable labels selected to move to the target slot. */
    deliverableTypes?: string[];
    /** Deliverable labels staying on the source slot (partial moves). */
    remainingTypes?: string[];
  }>;
  /** Partial market intelligence overrides — merged onto existing meta. */
  marketIntelligence?: Partial<MediaPlanMarketIntelligenceMeta>;
};

export type RescheduleMediaPlanResult = {
  campaignObject: CampaignObject;
  change: string | null;
};

export function cloneMediaPlanScheduleMeta(existing: MediaPlanScheduleMeta): MediaPlanScheduleMeta {
  return {
    weekWeights: existing.weekWeights ? [...existing.weekWeights] : undefined,
    assignments: existing.assignments ? [...existing.assignments] : undefined,
    priorityWeights: existing.priorityWeights ? { ...existing.priorityWeights } : undefined,
    marketIntelligence: existing.marketIntelligence
      ? {
          ...existing.marketIntelligence,
          toggles: existing.marketIntelligence.toggles
            ? { ...existing.marketIntelligence.toggles }
            : undefined,
          countries: existing.marketIntelligence.countries
            ? [...existing.marketIntelligence.countries]
            : undefined,
        }
      : undefined,
  };
}

export function mergeMediaPlanMarketIntelligenceMeta(
  existing: MediaPlanMarketIntelligenceMeta | undefined,
  patch: Partial<MediaPlanMarketIntelligenceMeta>
): MediaPlanMarketIntelligenceMeta {
  return {
    ...existing,
    ...patch,
    toggles: {
      ...existing?.toggles,
      ...patch.toggles,
    },
    countries: patch.countries ?? existing?.countries,
  };
}

/**
 * Low-level schedule patch — **do not call from feature code**.
 * Production writes must use `mutateMediaPlanSchedule` in `media-plan-mutations.ts`
 * (Media Plan Engine). Exported only for the engine bridge and tightly scoped tests.
 */
export function applyMediaPlanScheduleChangeUnchecked(
  campaignObject: CampaignObject,
  input: RescheduleMediaPlanInput
): RescheduleMediaPlanResult {
  const existing = mediaPlanScheduleFromMeta(campaignObject.meta) ?? {};
  const durationWeeks = resolveScheduleDurationWeeks(campaignObject, existing);
  const slate = resolveSlate(campaignObject);
  const next = cloneMediaPlanScheduleMeta(existing);
  const changes: string[] = [];

  if (input.marketIntelligence) {
    next.marketIntelligence = mergeMediaPlanMarketIntelligenceMeta(
      existing.marketIntelligence,
      input.marketIntelligence
    );
    changes.push("updated market intelligence scheduling factors");
  }

  if (input.weekWeights?.length) {
    next.weekWeights = normalizeWeekWeights(input.weekWeights, durationWeeks);
    changes.push(
      `shifted publishing weight across weeks (${next.weekWeights
        .map((weight, index) => `W${index + 1} ${weight}%`)
        .join(", ")})`
    );
  }

  if (input.moveCreators?.length) {
    const assignments = new Map(
      (next.assignments ?? []).map((assignment) => [assignmentKey(assignment), assignment])
    );

    for (const move of input.moveCreators) {
      const toWeek = move.toWeek;
      if (!toWeek || toWeek < 1 || toWeek > durationWeeks) continue;
      const toDayIndex =
        move.toDayIndex != null && move.toDayIndex >= 0 && move.toDayIndex <= 6
          ? move.toDayIndex
          : 0;
      const fromWeek =
        move.fromWeek != null && move.fromWeek >= 1 && move.fromWeek <= durationWeeks
          ? move.fromWeek
          : undefined;
      const fromDayIndex =
        move.fromDayIndex != null && move.fromDayIndex >= 0 && move.fromDayIndex <= 6
          ? move.fromDayIndex
          : undefined;
      const deliverableTypes = move.deliverableTypes?.filter((type) => type.trim()) ?? [];
      const remainingTypes = move.remainingTypes?.filter((type) => type.trim()) ?? [];
      const partialMove =
        remainingTypes.length > 0 &&
        fromWeek != null &&
        fromDayIndex != null &&
        (fromWeek !== toWeek || fromDayIndex !== toDayIndex);

      const applyCreatorMove = (creator: SlateCreator) => {
        const creatorPrefix = `${creator.creatorId.trim().toLowerCase()}::`;
        // Also clear pins left under a prior identity (e.g. influencer UUID vs Studio id).
        const aliasPrefixes = new Set<string>([creatorPrefix]);
        for (const aliasId of move.creatorIds ?? []) {
          const normalized = aliasId.trim().toLowerCase();
          if (normalized) aliasPrefixes.add(`${normalized}::`);
        }
        const clearCreatorAssignments = (onlyStar = false) => {
          for (const key of [...assignments.keys()]) {
            if (![...aliasPrefixes].some((prefix) => key.startsWith(prefix))) continue;
            if (onlyStar && !key.endsWith("::*")) continue;
            if (!onlyStar || key.endsWith("::*")) assignments.delete(key);
          }
        };
        const operationalRefs = {
          campaignLineId: creator.campaignLineId ?? null,
          assignmentDeliverableId: creator.assignmentDeliverableId ?? null,
          assignmentPostScheduleId: creator.assignmentPostScheduleId ?? null,
        };

        if (deliverableTypes.length) {
          // Typed pins must win over a legacy whole-creator "*" pin.
          clearCreatorAssignments(true);
          for (const serviceType of deliverableTypes) {
            assignments.set(
              assignmentKey({
                creatorId: creator.creatorId,
                week: toWeek,
                dayIndex: toDayIndex,
                serviceType,
              }),
              {
                creatorId: creator.creatorId,
                week: toWeek,
                dayIndex: toDayIndex,
                serviceType,
                ...operationalRefs,
              }
            );
          }
          if (partialMove && fromWeek != null && fromDayIndex != null) {
            for (const serviceType of remainingTypes) {
              assignments.set(
                assignmentKey({
                  creatorId: creator.creatorId,
                  week: fromWeek,
                  dayIndex: fromDayIndex,
                  serviceType,
                }),
                {
                  creatorId: creator.creatorId,
                  week: fromWeek,
                  dayIndex: fromDayIndex,
                  serviceType,
                  ...operationalRefs,
                }
              );
            }
          }
          const moveLabel =
            partialMove
              ? `${deliverableTypes.length} deliverable${deliverableTypes.length === 1 ? "" : "s"}`
              : creator.displayName;
          changes.push(`moved ${moveLabel} for ${creator.displayName} to Week ${toWeek}`);
          return;
        }

        // Whole-creator move: replace any prior typed pins for this creator.
        clearCreatorAssignments(false);
        assignments.set(
          assignmentKey({ creatorId: creator.creatorId, week: toWeek, dayIndex: toDayIndex }),
          {
            creatorId: creator.creatorId,
            week: toWeek,
            dayIndex: toDayIndex,
            ...operationalRefs,
          }
        );
        changes.push(`moved ${creator.displayName} to Week ${toWeek}`);
      };

      for (const creator of resolveCreatorsForMove(slate, move)) {
        applyCreatorMove(creator);
      }
    }

    next.assignments = [...assignments.values()];
  }

  if (changes.length === 0) {
    return { campaignObject, change: null };
  }

  return {
    campaignObject: {
      ...campaignObject,
      meta: {
        ...campaignObject.meta,
        mediaPlanSchedule: next,
      },
      updatedAt: new Date().toISOString(),
    },
    change: `Updated the media plan schedule — ${changes.join("; ")}.`,
  };
}

/** Parse "heavier in first 2 weeks vs last 2" style requests into week weights. */
export function parseWeekWeightIntent(
  text: string,
  durationWeeks: number
): number[] | undefined {
  const lower = text.toLowerCase();
  if (!/\b(weight|heavier|front[-\s]?load|concentrate|skew|bias)\b/i.test(lower)) {
    return undefined;
  }

  const firstMatch = lower.match(/\bfirst\s+(\d+)\s+weeks?\b/);
  const lastMatch = lower.match(/\blast\s+(\d+)\s+weeks?\b/);
  const firstWeeks = firstMatch ? Number(firstMatch[1]) : undefined;
  const lastWeeks = lastMatch ? Number(lastMatch[1]) : undefined;

  if (firstWeeks && lastWeeks && firstWeeks + lastWeeks <= durationWeeks) {
    const heavyShare = /\bheavier\b|\bmore\b|\bconcentrate\b|\bfront\b/i.test(lower) ? 70 : 60;
    const lightShare = 100 - heavyShare;
    const perHeavy = Math.floor(heavyShare / firstWeeks);
    const perLight = Math.floor(lightShare / lastWeeks);
    const weights = Array.from({ length: durationWeeks }, () => perLight);
    for (let index = 0; index < firstWeeks; index += 1) {
      weights[index] = perHeavy;
    }
    return normalizeWeekWeights(weights, durationWeeks);
  }

  if (/\bearly\b|\bfront\b|\blaunch\b/i.test(lower) && /\blater\b|\bend\b|\blast\b/i.test(lower)) {
    const weights = Array.from({ length: durationWeeks }, (_, index) =>
      index < Math.ceil(durationWeeks / 2) ? 20 : 10
    );
    return normalizeWeekWeights(weights, durationWeeks);
  }

  return undefined;
}

export type EffectiveWeekWeightResult = {
  /** Percentage weights reflecting actual creator placement (assignments included). */
  weights: number[];
  /** Brief- or meta-derived weights before manual slot moves. */
  baselineWeights: number[];
  /** True when assignments shifted distribution vs baseline. */
  scheduleAdjusted: boolean;
};

/** Count deliverables placed in each week after weight distribution + slot overrides. */
export function countCreatorsPerWeekFromSchedule(
  campaignObject: CampaignObject,
  durationWeeks: number
): number[] {
  const slate = resolveSlate(campaignObject);
  const weeks = Math.max(1, durationWeeks);
  if (!slate.length) return Array.from({ length: weeks }, () => 0);

  const schedule = mediaPlanScheduleFromMeta(campaignObject.meta);
  const briefText = resolveBriefTextForScheduling(campaignObject);
  const weekWeights =
    resolveMediaPlanWeekWeights(campaignObject, weeks) ??
    deriveWeekWeightsFromBrief(briefText, weeks) ??
    normalizeWeekWeights(
      Array.from({ length: weeks }, () => 100 / weeks),
      weeks
    );

  return countDeliverablesPerWeek(slate, weeks, {
    weekWeights,
    assignments: schedule?.assignments,
  });
}

function weightsDifferSignificantly(
  baseline: number[],
  effective: number[],
  threshold = 6
): boolean {
  const length = Math.max(baseline.length, effective.length);
  for (let index = 0; index < length; index += 1) {
    if (Math.abs((baseline[index] ?? 0) - (effective[index] ?? 0)) >= threshold) {
      return true;
    }
  }
  return false;
}

/** Resolve effective week weights from the live schedule (brief weights + manual moves). */
export function deriveEffectiveWeekWeights(
  campaignObject: CampaignObject,
  durationWeeks: number
): EffectiveWeekWeightResult {
  const weeks = Math.max(1, durationWeeks);
  const briefText = resolveBriefTextForScheduling(campaignObject);
  const baselineWeights =
    resolveMediaPlanWeekWeights(campaignObject, weeks) ??
    deriveWeekWeightsFromBrief(briefText, weeks) ??
    normalizeWeekWeights(
      Array.from({ length: weeks }, () => 100 / weeks),
      weeks
    );

  const schedule = mediaPlanScheduleFromMeta(campaignObject.meta);
  const weekCounts = countCreatorsPerWeekFromSchedule(campaignObject, weeks);
  const total = weekCounts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) {
    return { weights: baselineWeights, baselineWeights, scheduleAdjusted: false };
  }

  const weights = normalizeWeekWeights(weekCounts, weeks);
  const scheduleAdjusted =
    Boolean(schedule?.assignments?.length) ||
    weightsDifferSignificantly(baselineWeights, weights);
  return { weights, baselineWeights, scheduleAdjusted };
}
