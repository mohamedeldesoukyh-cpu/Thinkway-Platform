/**
 * Deterministic Media Plan calendar shifts — a **Revise** operation.
 *
 * Start/end updates recalculate the Saturday–Friday Publishing Calendar range and
 * rebind existing creator slots by absolute date. Waves, strategy, and deliverable
 * assignments are preserved unless the user explicitly Regenerates.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  asMediaPlanData,
  formatShortCampaignDate,
  rebuildMediaPlanDeadlinesFromWeeks,
  type MediaPlanData,
  type MediaPlanDay,
  type MediaPlanWeek,
} from "./generators/media-plan";
import { dateForCampaignSlot } from "./media-plan-week-range";
import {
  PUBLISHING_CALENDAR_DAYS,
  parseIsoCampaignDate,
  resolveBusinessCampaignEndIso,
  resolvePublishingCalendarRange,
  resolveScheduledStartDate,
  toIsoCampaignDate,
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

function emptyDay(dayIndex: number, dateLabel: string): MediaPlanDay {
  return {
    day: PUBLISHING_CALENDAR_DAYS[dayIndex] ?? "Saturday",
    dateLabel,
    type: "content",
    label: "",
  };
}

/** Collect day content keyed by absolute ISO date from an existing plan. */
function contentByAbsoluteDate(data: MediaPlanData): Map<string, MediaPlanDay> {
  const gridStart = parseIsoCampaignDate(data.scheduledStartDate ?? data.campaignStartDate);
  const map = new Map<string, MediaPlanDay>();
  if (!gridStart) return map;
  for (const week of data.weeks) {
    week.days.forEach((day, dayIndex) => {
      const iso = toIsoCampaignDate(dateForCampaignSlot(gridStart, week.week, dayIndex));
      map.set(iso, day);
    });
  }
  return map;
}

/**
 * Rebuild the Saturday–Friday grid for a new campaign date range and rebind
 * prior slot content onto matching calendar dates.
 */
export function rebindMediaPlanPublishingCalendar(
  data: MediaPlanData,
  input: {
    campaignStartIso: string;
    campaignEndIso: string;
    requestedStartDate?: string | null;
    durationWeeks?: number;
  }
): MediaPlanData {
  const range = resolvePublishingCalendarRange(input.campaignStartIso, input.campaignEndIso);
  if (!range) {
    throw new Error(
      `Invalid publishing calendar range: ${input.campaignStartIso} – ${input.campaignEndIso}`
    );
  }

  const priorByDate = contentByAbsoluteDate(data);
  const priorByWeek = new Map(data.weeks.map((w) => [w.week, w]));
  const sameWeekCount = range.weeks.length === data.weeks.length;

  // Same week count → structure-preserving relabel (Revise date shift).
  // Different count → rebind by absolute date only (new empty cells for added weeks).
  const weeks: MediaPlanWeek[] = range.weeks.map((meta) => {
    const prior = priorByWeek.get(meta.week);
    const days = PUBLISHING_CALENDAR_DAYS.map((dayName, dayIndex) => {
      const slotDate = dateForCampaignSlot(range.gridStartSaturday, meta.week, dayIndex);
      const iso = toIsoCampaignDate(slotDate);
      const dateLabel = formatShortCampaignDate(slotDate);

      if (sameWeekCount && prior?.days[dayIndex]) {
        return {
          ...prior.days[dayIndex]!,
          day: dayName,
          dateLabel,
        };
      }

      const fromDate = priorByDate.get(iso);
      if (fromDate) {
        return {
          ...fromDate,
          day: dayName,
          dateLabel,
        };
      }
      return emptyDay(dayIndex, dateLabel);
    });
    return {
      week: meta.week,
      wave: prior?.wave ?? meta.week,
      phase: prior?.phase ?? "",
      days,
    };
  });

  const gridStartIso = range.gridStartIso;
  const deadlines = rebuildMediaPlanDeadlinesFromWeeks(weeks, gridStartIso);

  return {
    ...data,
    durationWeeks:
      input.durationWeeks != null && Number.isFinite(input.durationWeeks)
        ? input.durationWeeks
        : data.durationWeeks,
    calendarWeeks: weeks.length,
    campaignStartDate: gridStartIso,
    scheduledStartDate: gridStartIso,
    requestedStartDate:
      input.requestedStartDate !== undefined
        ? input.requestedStartDate ?? undefined
        : data.requestedStartDate,
    campaignEndDate: input.campaignEndIso,
    weeks,
    deadlines,
  };
}

export type ShiftMediaPlanStartOptions = {
  /** User-requested go-live (may be mid-week). */
  requestedStartDate?: string | null;
  /** Optional duration fact sync — recalculates calendar range when provided. */
  durationWeeks?: number;
  /** Explicit inclusive campaign end (preferred over duration when set). */
  campaignEndDate?: string | null;
  /**
   * Scheduling mode. Only `calendar_week` (Saturday–Friday) is implemented.
   */
  schedulingMode?: MediaPlanWeekSchedulingMode;
};

/**
 * Shift / resize an existing Media Plan onto a new Publishing Calendar range.
 * Preserves structure by absolute date; refreshes labels + deadlines.
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

  const requested =
    options?.requestedStartDate?.trim() ||
    data.requestedStartDate ||
    nextScheduledIso;
  const businessStart = parseIsoCampaignDate(requested)
    ? requested
    : nextScheduledIso;
  const gridFromRequested = resolveScheduledStartDate(businessStart) ?? nextScheduledIso;

  const durationWeeks = options?.durationWeeks ?? data.durationWeeks;
  const campaignEndIso =
    resolveBusinessCampaignEndIso({
      campaignStartIso: businessStart,
      campaignEndIso: options?.campaignEndDate ?? data.campaignEndDate,
      durationWeeks,
    }) ?? data.campaignEndDate;

  if (!campaignEndIso) {
    // Fallback: pure day-offset relabel on existing week count
    const scheduledStart = parseIsoCampaignDate(gridFromRequested);
    if (!scheduledStart) {
      throw new Error(`Invalid scheduled start date: ${gridFromRequested}`);
    }
    const weeks = data.weeks.map((week) => ({
      ...week,
      days: week.days.map((day, dayIndex) => ({
        ...day,
        day: PUBLISHING_CALENDAR_DAYS[dayIndex] ?? day.day,
        dateLabel: formatShortCampaignDate(
          dateForCampaignSlot(scheduledStart, week.week, dayIndex)
        ),
      })),
    }));
    return {
      ...data,
      campaignStartDate: gridFromRequested,
      scheduledStartDate: gridFromRequested,
      requestedStartDate:
        options?.requestedStartDate !== undefined
          ? options.requestedStartDate ?? undefined
          : data.requestedStartDate,
      durationWeeks,
      weeks,
      deadlines: rebuildMediaPlanDeadlinesFromWeeks(weeks, gridFromRequested),
    };
  }

  return rebindMediaPlanPublishingCalendar(data, {
    campaignStartIso: businessStart,
    campaignEndIso,
    requestedStartDate: options?.requestedStartDate ?? businessStart,
    durationWeeks,
  });
}

/**
 * Duration-only fact sync — recalculates Publishing Calendar range when an end
 * date can be derived; otherwise updates the fact only.
 */
export function syncMediaPlanDurationFact(
  data: MediaPlanData,
  durationWeeks: number
): MediaPlanData {
  const businessStart =
    data.requestedStartDate ?? data.campaignStartDate ?? data.scheduledStartDate;
  if (!businessStart) return { ...data, durationWeeks };
  const endIso = resolveBusinessCampaignEndIso({
    campaignStartIso: businessStart,
    durationWeeks,
  });
  if (!endIso) return { ...data, durationWeeks };
  return rebindMediaPlanPublishingCalendar(data, {
    campaignStartIso: businessStart,
    campaignEndIso: endIso,
    requestedStartDate: data.requestedStartDate ?? businessStart,
    durationWeeks,
  });
}

/**
 * Persist a patched Media Plan as a **Revise** (business-version rules apply).
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
          } (${dayOffset > 0 ? "later" : "earlier"}) on Saturday–Friday weeks — structure preserved.`
        : "Revised Media Plan publishing calendar range — creators and slots rebound by date.",
  });

  if (!committed) {
    return { campaignObject, shifted: false, dayOffset };
  }
  return {
    campaignObject: committed.campaignObject,
    shifted: true,
    dayOffset,
  };
}
