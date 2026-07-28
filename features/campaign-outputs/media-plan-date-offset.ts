/**
 * Deterministic Media Plan calendar shifts.
 *
 * Start-date updates are pure date-offset transforms over the existing Media Plan
 * SSOT: week/day slots, creators, deliverables, waves, milestones, and publishing
 * order stay intact. Only calendar anchors, day labels, and derived deadlines move.
 *
 * Never call the Media Plan generator from this path — regeneration is reserved for
 * explicit generate/regenerate requests.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  asMediaPlanData,
  formatShortCampaignDate,
  mediaPlanContentFromData,
  rebuildMediaPlanDeadlinesFromWeeks,
  type MediaPlanData,
  type MediaPlanWeek,
} from "./generators/media-plan";
import { dateForCampaignSlot } from "./media-plan-week-range";
import {
  parseIsoCampaignDate,
  type MediaPlanWeekSchedulingMode,
} from "./media-plan-week-start";
import { getOutputDefinition } from "./output-catalog";
import {
  computeInputFingerprints,
  computeSourceFingerprint,
} from "./output-fingerprint";
import type {
  CampaignOutputOrigin,
  CampaignOutputRecord,
  CampaignOutputVersionSnapshot,
} from "./output-types";

const MAX_OUTPUT_HISTORY = 12;

function mediaPlanRecordOf(campaignObject: CampaignObject): CampaignOutputRecord | undefined {
  return campaignObject.meta.campaignOutputs?.media_plan;
}

/** Whole calendar days between two YYYY-MM-DD anchors (local noon). */
export function calendarDayOffset(fromIso: string, toIso: string): number | null {
  const from = parseIsoCampaignDate(fromIso);
  const to = parseIsoCampaignDate(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function relabelWeekDays(weeks: MediaPlanWeek[], scheduledStart: Date): MediaPlanWeek[] {
  return weeks.map((week) => ({
    ...week,
    days: week.days.map((day, dayIndex) => ({
      ...day,
      dateLabel: formatShortCampaignDate(
        dateForCampaignSlot(scheduledStart, week.week, dayIndex)
      ),
    })),
  }));
}

export type ShiftMediaPlanStartOptions = {
  /** User-requested go-live (may be mid-week). */
  requestedStartDate?: string | null;
  /** Optional duration fact sync — does not add/remove weeks. */
  durationWeeks?: number;
  /**
   * Scheduling mode. Only `calendar_week` is implemented today.
   * `campaign_relative_week` is reserved for a future mode.
   */
  schedulingMode?: MediaPlanWeekSchedulingMode;
};

/**
 * Shift an existing Media Plan onto a new Monday Week-1 anchor.
 * Preserves structure; refreshes date labels + production deadlines only.
 */
export function shiftMediaPlanDataToScheduledStart(
  data: MediaPlanData,
  nextScheduledIso: string,
  options?: ShiftMediaPlanStartOptions
): MediaPlanData {
  const mode = options?.schedulingMode ?? "calendar_week";
  if (mode !== "calendar_week") {
    throw new Error(
      `Media Plan scheduling mode "${mode}" is not implemented yet. Use calendar_week.`
    );
  }

  const scheduledStart = parseIsoCampaignDate(nextScheduledIso);
  if (!scheduledStart) {
    throw new Error(`Invalid scheduled start date: ${nextScheduledIso}`);
  }

  const weeks = relabelWeekDays(data.weeks, scheduledStart);
  const deadlines = rebuildMediaPlanDeadlinesFromWeeks(weeks, nextScheduledIso);

  return {
    ...data,
    campaignStartDate: nextScheduledIso,
    scheduledStartDate: nextScheduledIso,
    requestedStartDate:
      options?.requestedStartDate !== undefined
        ? options.requestedStartDate ?? undefined
        : data.requestedStartDate,
    durationWeeks:
      options?.durationWeeks != null && Number.isFinite(options.durationWeeks)
        ? options.durationWeeks
        : data.durationWeeks,
    weeks,
    deadlines,
    // Explicitly keep structural fields by spreading data above:
    // waves, milestones, platformAllocation, dependencies, creator slots.
  };
}

/**
 * Duration-only fact sync on an existing plan — does not grow/shrink the grid.
 * Callers should tell the user to regenerate only if they want a new week count.
 */
export function syncMediaPlanDurationFact(
  data: MediaPlanData,
  durationWeeks: number
): MediaPlanData {
  return { ...data, durationWeeks };
}

/**
 * Persist a patched Media Plan view and refresh fingerprints so the calendar is
 * not marked stale (and therefore not silently regenerated on display).
 */
export function commitPatchedMediaPlanOutput(
  campaignObject: CampaignObject,
  data: MediaPlanData,
  options?: {
    now?: string;
    origin?: CampaignOutputOrigin;
    changeReason?: string;
  }
): { campaignObject: CampaignObject; record: CampaignOutputRecord } | null {
  const definition = getOutputDefinition("media_plan");
  if (!definition) return null;

  const previous = mediaPlanRecordOf(campaignObject);
  if (!previous) return null;
  const state = campaignObject.meta.campaignOutputs ?? {};

  const now = options?.now ?? new Date().toISOString();
  const content = mediaPlanContentFromData(data, previous.content);
  const fingerprint = computeSourceFingerprint(campaignObject, definition.inputKeys);
  const inputFingerprints = computeInputFingerprints(campaignObject, definition.inputKeys);

  const history: CampaignOutputVersionSnapshot[] = [
    ...(previous.history ?? []),
    {
      version: previous.version,
      generatedAt: previous.generatedAt,
      updatedAt: previous.updatedAt,
      sourceFingerprint: previous.sourceFingerprint,
      generatorVersion: previous.generatorVersion,
      changeReason: previous.changeReason,
      changedInputs: previous.changedInputs,
      origin: previous.origin,
      content: previous.content,
    },
  ].slice(-MAX_OUTPUT_HISTORY);

  let sizeBytes = 0;
  try {
    sizeBytes = JSON.stringify(content).length;
  } catch {
    sizeBytes = previous.sizeBytes ?? 0;
  }

  const record = {
    ...previous,
    kind: "media_plan" as const,
    status: "generated" as const,
    version: previous.version + 1,
    updatedAt: now,
    sourceFingerprint: fingerprint,
    inputFingerprints,
    generatorVersion: previous.generatorVersion ?? definition.generatorVersion,
    origin: options?.origin ?? previous.origin ?? "copilot",
    sizeBytes,
    changeReason: options?.changeReason ?? "Timeline calendar shifted (date offset).",
    changedInputs: ["timeline" as const],
    history,
    content,
  };

  const nextObject: CampaignObject = {
    ...campaignObject,
    // Bump so Studio binding / overlays cannot stick on the prior timestamp.
    updatedAt: now,
    meta: {
      ...campaignObject.meta,
      campaignOutputs: { ...state, media_plan: record },
    },
  };

  return { campaignObject: nextObject, record };
}

/** Apply a start-date offset to the campaign's stored Media Plan, if present. */
export function applyMediaPlanStartDateOffset(
  campaignObject: CampaignObject,
  nextScheduledIso: string,
  options?: ShiftMediaPlanStartOptions & {
    now?: string;
    origin?: CampaignOutputOrigin;
  }
): { campaignObject: CampaignObject; shifted: boolean; dayOffset: number | null } {
  const previous = mediaPlanRecordOf(campaignObject);
  const data = asMediaPlanData(previous?.content?.data);
  if (!previous || !data) {
    return { campaignObject, shifted: false, dayOffset: null };
  }

  const prevAnchor = data.scheduledStartDate ?? data.campaignStartDate;
  const dayOffset = calendarDayOffset(prevAnchor, nextScheduledIso);
  if (dayOffset === 0 && (options?.durationWeeks == null || options.durationWeeks === data.durationWeeks)) {
    // Still refresh requested/scheduled fields on the stored plan when they drift.
    if (
      data.scheduledStartDate === nextScheduledIso &&
      data.campaignStartDate === nextScheduledIso &&
      (options?.requestedStartDate == null ||
        data.requestedStartDate === options.requestedStartDate)
    ) {
      return { campaignObject, shifted: false, dayOffset: 0 };
    }
  }

  const shiftedData = shiftMediaPlanDataToScheduledStart(data, nextScheduledIso, options);
  const committed = commitPatchedMediaPlanOutput(campaignObject, shiftedData, {
    now: options?.now,
    origin: options?.origin,
    changeReason: "Timeline start date shifted (deterministic calendar offset).",
  });

  return {
    campaignObject: committed?.campaignObject ?? campaignObject,
    shifted: Boolean(committed),
    dayOffset,
  };
}
