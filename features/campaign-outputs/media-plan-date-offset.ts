/**
 * Deterministic Media Plan calendar shifts — a **Revise** operation.
 *
 * Start-date updates are pure date-offset transforms over the existing Media Plan
 * SSOT: week/day slots, creators, deliverables, waves, milestones, and publishing
 * order stay intact. Only calendar anchors, day labels, and derived deadlines move.
 *
 * Never call the Media Plan generator from this path — regeneration is reserved for
 * explicit Regenerate requests (major version).
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  asMediaPlanData,
  formatShortCampaignDate,
  rebuildMediaPlanDeadlinesFromWeeks,
  type MediaPlanData,
  type MediaPlanWeek,
} from "./generators/media-plan";
import { dateForCampaignSlot } from "./media-plan-week-range";
import {
  parseIsoCampaignDate,
  type MediaPlanWeekSchedulingMode,
} from "./media-plan-week-start";
import { reviseMediaPlanOutput } from "./media-plan-revise-regenerate";
import type { CampaignOutputOrigin, CampaignOutputRecord } from "./output-types";

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
 * Persist a patched Media Plan as a **Revise** (minor version bump).
 */
export function commitPatchedMediaPlanOutput(
  campaignObject: CampaignObject,
  data: MediaPlanData,
  options?: {
    now?: string;
    origin?: CampaignOutputOrigin;
    changeReason?: string;
    changeSummary?: string;
    actorUserId?: string;
  }
): { campaignObject: CampaignObject; record: CampaignOutputRecord } | null {
  return reviseMediaPlanOutput(campaignObject, data, {
    now: options?.now,
    origin: options?.origin,
    actorUserId: options?.actorUserId,
    changeReason: options?.changeReason ?? "Timeline calendar shifted (date offset).",
    changeSummary:
      options?.changeSummary ??
      "Revised Media Plan calendar dates — creators, waves, deliverables, and publishing order preserved.",
    changedInputs: ["timeline"],
  });
}

/** Apply a start-date offset to the campaign's stored Media Plan, if present. */
export function applyMediaPlanStartDateOffset(
  campaignObject: CampaignObject,
  nextScheduledIso: string,
  options?: ShiftMediaPlanStartOptions & {
    now?: string;
    origin?: CampaignOutputOrigin;
    actorUserId?: string;
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
    actorUserId: options?.actorUserId,
    changeReason: "Timeline start date shifted (deterministic calendar offset).",
    changeSummary:
      dayOffset != null && dayOffset !== 0
        ? `Revised Media Plan: calendar shifted ${Math.abs(dayOffset)} day${
            Math.abs(dayOffset) === 1 ? "" : "s"
          } ${dayOffset > 0 ? "forward" : "backward"} (structure preserved).`
        : "Revised Media Plan: calendar anchors updated (structure preserved).",
  });

  return {
    campaignObject: committed?.campaignObject ?? campaignObject,
    shifted: Boolean(committed),
    dayOffset,
  };
}
