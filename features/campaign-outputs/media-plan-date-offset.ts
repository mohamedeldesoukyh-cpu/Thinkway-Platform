/**
 * Deterministic Media Plan calendar shifts — a **Revise** operation.
 *
 * When the campaign start (or end) changes:
 * 1. Recalculate the Saturday–Friday Publishing Calendar range
 * 2. Shift every publishing slot by the business-start day offset
 * 3. Rebind creators onto the new slot dates
 *
 * Preserves creator sequence, waves, deliverables, and strategy.
 * Never regenerates — that is an explicit Regenerate.
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
  type PublishingCalendarRange,
} from "./media-plan-week-start";
import { enforceMediaPlanCampaignWindow } from "./media-plan-campaign-window";
import {
  cloneMediaPlanScheduleMeta,
  mediaPlanScheduleFromMeta,
  type MediaPlanSlotAssignment,
} from "./media-plan-schedule";
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

function addCalendarDays(iso: string, days: number): string | null {
  const date = parseIsoCampaignDate(iso);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return toIsoCampaignDate(date);
}

function emptyDay(dayIndex: number, dateLabel: string): MediaPlanDay {
  return {
    day: PUBLISHING_CALENDAR_DAYS[dayIndex] ?? "Saturday",
    dateLabel,
    type: "content",
    label: "",
  };
}

function dayHasPublishingContent(day: MediaPlanDay): boolean {
  return Boolean(
    day.creatorId ||
      day.creator ||
      day.additionalDeliverables?.length ||
      (day.label?.trim() &&
        day.label !== "Open publishing slot" &&
        day.label !== "Creator publishing slot")
  );
}

/** First absolute ISO date that holds creator/publishing content (sequence start). */
export function firstPublishingSlotIso(data: MediaPlanData): string | null {
  const gridStart = parseIsoCampaignDate(data.scheduledStartDate ?? data.campaignStartDate);
  if (!gridStart) return null;
  const ordered = [...data.weeks].sort((a, b) => a.week - b.week);
  for (const week of ordered) {
    for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
      const day = week.days[dayIndex]!;
      if (!dayHasPublishingContent(day)) continue;
      return toIsoCampaignDate(dateForCampaignSlot(gridStart, week.week, dayIndex));
    }
  }
  return null;
}

/**
 * Business start used as the Revision offset anchor.
 * Prefer explicit requested start; else first occupied publish day; else grid Saturday.
 */
export function resolvePriorBusinessStartIso(data: MediaPlanData): string | null {
  const requested = data.requestedStartDate?.trim();
  if (requested && parseIsoCampaignDate(requested)) return requested;
  return firstPublishingSlotIso(data) ?? data.scheduledStartDate ?? data.campaignStartDate ?? null;
}

function buildEmptyWeeks(range: PublishingCalendarRange, prior: MediaPlanWeek[]): MediaPlanWeek[] {
  const priorByWeek = new Map(prior.map((w) => [w.week, w]));
  return range.weeks.map((meta) => {
    const prev = priorByWeek.get(meta.week);
    return {
      week: meta.week,
      wave: prev?.wave ?? meta.week,
      phase: prev?.phase ?? "",
      days: PUBLISHING_CALENDAR_DAYS.map((day, dayIndex) =>
        emptyDay(
          dayIndex,
          formatShortCampaignDate(
            dateForCampaignSlot(range.gridStartSaturday, meta.week, dayIndex)
          )
        )
      ),
    };
  });
}

function slotIndexOnGrid(
  range: PublishingCalendarRange,
  iso: string
): { week: number; dayIndex: number } | null {
  const date = parseIsoCampaignDate(iso);
  if (!date) return null;
  if (
    date.getTime() < range.gridStartSaturday.getTime() ||
    date.getTime() > range.gridEndFriday.getTime()
  ) {
    return null;
  }
  const dayOffset = Math.round(
    (date.getTime() - range.gridStartSaturday.getTime()) / (24 * 60 * 60 * 1000)
  );
  const week = Math.floor(dayOffset / 7) + 1;
  const dayIndex = dayOffset % 7;
  if (week < 1 || week > range.weeks.length) return null;
  return { week, dayIndex };
}

/**
 * Rebuild the Saturday–Friday grid for a new campaign date range and rebind
 * prior slot content by shifting absolute publish dates by the business-start offset.
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

  const priorBusinessStart = resolvePriorBusinessStartIso(data);
  const offsetDays =
    priorBusinessStart != null
      ? calendarDayOffset(priorBusinessStart, input.campaignStartIso) ?? 0
      : 0;

  const oldGridStart = parseIsoCampaignDate(data.scheduledStartDate ?? data.campaignStartDate);
  const weeks = buildEmptyWeeks(range, data.weeks);
  const overflow: MediaPlanDay[] = [];

  const placeOrPark = (day: MediaPlanDay, target: { week: number; dayIndex: number } | null) => {
    if (!target) {
      overflow.push(day);
      return;
    }
    const targetWeek = weeks.find((w) => w.week === target.week);
    if (!targetWeek) {
      overflow.push(day);
      return;
    }
    const dateLabel = formatShortCampaignDate(
      dateForCampaignSlot(range.gridStartSaturday, target.week, target.dayIndex)
    );
    const existing = targetWeek.days[target.dayIndex]!;
    if (!dayHasPublishingContent(existing)) {
      targetWeek.days[target.dayIndex] = {
        ...day,
        day: PUBLISHING_CALENDAR_DAYS[target.dayIndex] ?? day.day,
        dateLabel,
      };
      return;
    }
    // Collision after shift — park for campaign-window rebalance.
    overflow.push(day);
  };

  if (oldGridStart) {
    for (const week of data.weeks) {
      week.days.forEach((day, dayIndex) => {
        if (!dayHasPublishingContent(day)) return;
        const oldIso = toIsoCampaignDate(dateForCampaignSlot(oldGridStart, week.week, dayIndex));
        const newIso = addCalendarDays(oldIso, offsetDays);
        if (!newIso) {
          overflow.push(day);
          return;
        }
        placeOrPark(day, slotIndexOnGrid(range, newIso));
      });
    }
  }

  // Park overflow on the last grid cell so enforce/rebalance can redistribute in-window.
  if (overflow.length) {
    const lastWeek = weeks[weeks.length - 1];
    if (lastWeek?.days.length) {
      const parkIndex = lastWeek.days.length - 1;
      for (const day of overflow) {
        const existing = lastWeek.days[parkIndex]!;
        if (!dayHasPublishingContent(existing)) {
          lastWeek.days[parkIndex] = {
            ...day,
            day: PUBLISHING_CALENDAR_DAYS[parkIndex] ?? day.day,
            dateLabel: existing.dateLabel,
          };
        } else {
          lastWeek.days[parkIndex] = {
            ...existing,
            additionalDeliverables: [
              ...(existing.additionalDeliverables ?? []),
              {
                creatorId: day.creatorId,
                creator: day.creator,
                shortName: day.shortName,
                handle: day.handle,
                avatarUrl: day.avatarUrl,
                profileUrl: day.profileUrl,
                platform: day.platform,
                serviceType: day.serviceType,
                serviceTypes: day.serviceTypes,
                tier: day.tier,
              },
              ...(day.additionalDeliverables ?? []),
            ],
          };
        }
      }
    }
  }

  // Preserve wave/phase metadata from prior weeks where possible
  const priorByWeek = new Map(data.weeks.map((w) => [w.week, w]));
  for (const week of weeks) {
    const prior = priorByWeek.get(week.week);
    if (prior) {
      week.wave = prior.wave;
      week.phase = prior.phase;
    }
  }

  const gridStartIso = range.gridStartIso;
  const deadlines = rebuildMediaPlanDeadlinesFromWeeks(weeks, gridStartIso);

  const rebound: MediaPlanData = {
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

  // Hard constraint overrides cadence — nothing outside Campaign Start–End.
  return enforceMediaPlanCampaignWindow(rebound);
}

/** Rebuild meta.mediaPlanSchedule.assignments from rebound calendar weeks. */
export function syncScheduleAssignmentsFromMediaPlanData(
  campaignObject: CampaignObject,
  data: MediaPlanData
): CampaignObject {
  const existing = mediaPlanScheduleFromMeta(campaignObject.meta) ?? {};
  const assignments: MediaPlanSlotAssignment[] = [];
  for (const week of data.weeks) {
    week.days.forEach((day, dayIndex) => {
      if (!day.creatorId) return;
      const types =
        day.serviceTypes?.length
          ? day.serviceTypes
          : day.serviceType
            ? [day.serviceType]
            : [undefined];
      for (const serviceType of types) {
        assignments.push({
          creatorId: day.creatorId,
          week: week.week,
          dayIndex,
          ...(serviceType ? { serviceType } : {}),
          campaignLineId: day.campaignLineId ?? null,
          assignmentDeliverableId: day.assignmentDeliverableId ?? null,
          assignmentPostScheduleId: day.assignmentPostScheduleId ?? null,
        });
      }
      for (const extra of day.additionalDeliverables ?? []) {
        if (!extra.creatorId) continue;
        const extraTypes =
          extra.serviceTypes?.length
            ? extra.serviceTypes
            : extra.serviceType
              ? [extra.serviceType]
              : [undefined];
        for (const serviceType of extraTypes) {
          assignments.push({
            creatorId: extra.creatorId,
            week: week.week,
            dayIndex,
            ...(serviceType ? { serviceType } : {}),
            campaignLineId: extra.campaignLineId ?? day.campaignLineId ?? null,
            assignmentDeliverableId:
              extra.assignmentDeliverableId ?? day.assignmentDeliverableId ?? null,
            assignmentPostScheduleId:
              extra.assignmentPostScheduleId ?? day.assignmentPostScheduleId ?? null,
          });
        }
      }
    });
  }
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      mediaPlanSchedule: cloneMediaPlanScheduleMeta({
        ...existing,
        assignments,
      }),
    },
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
 * Rebinds creators by business-start day offset onto new slot dates.
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

  const durationWeeks = options?.durationWeeks ?? data.durationWeeks;
  const campaignEndIso =
    resolveBusinessCampaignEndIso({
      campaignStartIso: businessStart,
      campaignEndIso: options?.campaignEndDate ?? data.campaignEndDate,
      durationWeeks,
    }) ?? data.campaignEndDate;

  if (!campaignEndIso) {
    // Derive a minimal end from existing week span so rebind can still run.
    const gridStart = resolveScheduledStartDate(businessStart) ?? nextScheduledIso;
    const weekCount = Math.max(1, data.weeks.length);
    const endDate = parseIsoCampaignDate(gridStart);
    if (!endDate) {
      throw new Error(`Invalid scheduled start date: ${gridStart}`);
    }
    endDate.setDate(endDate.getDate() + weekCount * 7 - 1);
    return rebindMediaPlanPublishingCalendar(data, {
      campaignStartIso: businessStart,
      campaignEndIso: toIsoCampaignDate(endDate),
      requestedStartDate: options?.requestedStartDate ?? businessStart,
      durationWeeks,
    });
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
 * date can be derived; rebinds slots when the range changes.
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
      "Revised Media Plan calendar dates — creators rebound to new publishing slots; waves and strategy preserved.",
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

  const priorBusinessStart = resolvePriorBusinessStartIso(data);
  const nextBusinessStart =
    options?.requestedStartDate?.trim() ||
    priorBusinessStart ||
    nextScheduledIso;
  const businessOffset =
    priorBusinessStart != null
      ? calendarDayOffset(priorBusinessStart, nextBusinessStart)
      : calendarDayOffset(data.scheduledStartDate ?? data.campaignStartDate, nextScheduledIso);

  const prevGrid = data.scheduledStartDate ?? data.campaignStartDate;
  const gridOffset = calendarDayOffset(prevGrid, nextScheduledIso);

  const nextEnd =
    options?.campaignEndDate?.trim() ||
    resolveBusinessCampaignEndIso({
      campaignStartIso: nextBusinessStart,
      campaignEndIso: options?.campaignEndDate,
      durationWeeks: options?.durationWeeks ?? data.durationWeeks,
    });
  const priorEnd =
    data.campaignEndDate?.trim() ||
    resolveBusinessCampaignEndIso({
      campaignStartIso: priorBusinessStart ?? data.scheduledStartDate ?? data.campaignStartDate ?? "",
      campaignEndIso: data.campaignEndDate,
      durationWeeks: data.durationWeeks,
    });

  if (
    businessOffset === 0 &&
    gridOffset === 0 &&
    (options?.durationWeeks == null || options.durationWeeks === data.durationWeeks) &&
    data.requestedStartDate === (options?.requestedStartDate ?? data.requestedStartDate) &&
    (nextEnd == null || nextEnd === priorEnd)
  ) {
    return { campaignObject, shifted: false, dayOffset: 0 };
  }

  let shiftedData: MediaPlanData;
  try {
    shiftedData = shiftMediaPlanDataToScheduledStart(data, nextScheduledIso, options);
  } catch {
    return { campaignObject, shifted: false, dayOffset: businessOffset };
  }
  const withSchedule = syncScheduleAssignmentsFromMediaPlanData(campaignObject, shiftedData);
  let committed: ReturnType<typeof commitPatchedMediaPlanOutput>;
  try {
    committed = commitPatchedMediaPlanOutput(withSchedule, shiftedData, {
      now: options?.now,
      origin: options?.origin,
      actorUserId: options?.actorUserId,
      changeReason: "Timeline start date shifted (deterministic slot rebind).",
      changeSummary:
        businessOffset != null && businessOffset !== 0
          ? `Revised Media Plan: publishing slots shifted ${Math.abs(businessOffset)} day${
              Math.abs(businessOffset) === 1 ? "" : "s"
            } (${businessOffset > 0 ? "later" : "earlier"}) — creators rebound; waves and strategy preserved.`
          : "Revised Media Plan publishing calendar range — creators rebound to new slot dates.",
    });
  } catch {
    return { campaignObject, shifted: false, dayOffset: businessOffset };
  }

  if (!committed) {
    return { campaignObject, shifted: false, dayOffset: businessOffset };
  }
  return {
    campaignObject: committed.campaignObject,
    shifted: true,
    dayOffset: businessOffset,
  };
}
