import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

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
  /** Explicit creator slot overrides (week 1-based, dayIndex 0=Monday). */
  assignments?: MediaPlanSlotAssignment[];
};

export type MediaPlanSlotAssignment = {
  creatorId: string;
  week: number;
  dayIndex: number;
};

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

export type RescheduleMediaPlanInput = {
  weekWeights?: number[];
  moveCreators?: Array<{
    names?: string[];
    /** Direct slate creator ids — used by interactive schedule UI. */
    creatorIds?: string[];
    fromWeek?: number;
    toWeek?: number;
    toDayIndex?: number;
  }>;
};

export type RescheduleMediaPlanResult = {
  campaignObject: CampaignObject;
  change: string | null;
};

export function applyMediaPlanScheduleChange(
  campaignObject: CampaignObject,
  input: RescheduleMediaPlanInput
): RescheduleMediaPlanResult {
  const facts = getCampaignFacts(campaignObject);
  const durationWeeks = Math.max(1, facts?.durationWeeks ?? 4);
  const slate = resolveSlate(campaignObject);
  const existing = mediaPlanScheduleFromMeta(campaignObject.meta) ?? {};
  const next: MediaPlanScheduleMeta = {
    weekWeights: existing.weekWeights ? [...existing.weekWeights] : undefined,
    assignments: existing.assignments ? [...existing.assignments] : undefined,
  };
  const changes: string[] = [];

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
      (next.assignments ?? []).map((assignment) => [assignment.creatorId, assignment])
    );

    for (const move of input.moveCreators) {
      const toWeek = move.toWeek;
      if (!toWeek || toWeek < 1 || toWeek > durationWeeks) continue;
      const toDayIndex =
        move.toDayIndex != null && move.toDayIndex >= 0 && move.toDayIndex <= 6
          ? move.toDayIndex
          : 0;

      for (const creatorId of move.creatorIds ?? []) {
        const creator = slate.find(
          (entry) => normalizeCreatorId(entry.creatorId) === normalizeCreatorId(creatorId)
        );
        if (!creator) continue;
        assignments.set(creator.creatorId, {
          creatorId: creator.creatorId,
          week: toWeek,
          dayIndex: toDayIndex,
        });
        changes.push(`moved ${creator.displayName} to Week ${toWeek}`);
      }

      for (const name of move.names ?? []) {
        const creator = findSlateCreatorByName(slate, name);
        if (!creator) continue;
        assignments.set(creator.creatorId, {
          creatorId: creator.creatorId,
          week: toWeek,
          dayIndex: toDayIndex,
        });
        changes.push(`moved ${creator.displayName} to Week ${toWeek}`);
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
  if (!schedule?.assignments?.length) {
    return { weights: baselineWeights, baselineWeights, scheduleAdjusted: false };
  }

  const weekCounts = countCreatorsPerWeekFromSchedule(campaignObject, weeks);
  const total = weekCounts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) {
    return { weights: baselineWeights, baselineWeights, scheduleAdjusted: false };
  }

  const weights = normalizeWeekWeights(weekCounts, weeks);
  const scheduleAdjusted = weightsDifferSignificantly(baselineWeights, weights);
  return { weights, baselineWeights, scheduleAdjusted };
}
