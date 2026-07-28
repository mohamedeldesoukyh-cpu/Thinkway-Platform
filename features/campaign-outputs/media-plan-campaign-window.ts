/**
 * Campaign Window — hard scheduling constraint (SSOT business rule).
 *
 * Campaign Start Date and Campaign End Date define the absolute publishing window.
 * Generate and Revise must never place creators, deliverables, or publishing slots
 * outside this window. Optimisation / cadence yield to the window.
 */

import {
  formatShortCampaignDate,
  rebuildMediaPlanDeadlinesFromWeeks,
  type MediaPlanAdditionalDeliverable,
  type MediaPlanData,
  type MediaPlanDay,
  type MediaPlanWeek,
} from "./generators/media-plan";
import { dateForCampaignSlot } from "./media-plan-week-range";
import {
  PUBLISHING_CALENDAR_DAYS,
  parseIsoCampaignDate,
  resolveBusinessCampaignEndIso,
  toIsoCampaignDate,
} from "./media-plan-week-start";

export type CampaignWindow = {
  /** Inclusive business campaign start (YYYY-MM-DD). */
  startIso: string;
  /** Inclusive business campaign end (YYYY-MM-DD). */
  endIso: string;
};

export type CampaignWindowViolation = {
  week: number;
  dayIndex: number;
  dateIso: string;
  reason: "before_start" | "after_end";
  creatorId?: string;
  creator?: string;
  label?: string;
};

export class MediaPlanCampaignWindowError extends Error {
  readonly code = "CAMPAIGN_WINDOW_VIOLATION" as const;
  readonly violations: CampaignWindowViolation[];

  constructor(message: string, violations: CampaignWindowViolation[]) {
    super(message);
    this.name = "MediaPlanCampaignWindowError";
    this.violations = violations;
  }
}

function dayHasCreatorPublishing(day: MediaPlanDay): boolean {
  return Boolean(
    day.creatorId ||
      day.creator ||
      day.additionalDeliverables?.length ||
      (day.type !== "monitoring" &&
        day.label?.trim() &&
        day.label !== "Open publishing slot" &&
        day.label !== "Creator publishing slot" &&
        day.label !== "Performance review")
  );
}

function emptyDay(dayIndex: number, dateLabel: string): MediaPlanDay {
  return {
    day: PUBLISHING_CALENDAR_DAYS[dayIndex] ?? "Saturday",
    dateLabel,
    type: "content",
    label: "",
  };
}

function monitoringDay(dayIndex: number, dateLabel: string): MediaPlanDay {
  return {
    day: PUBLISHING_CALENDAR_DAYS[dayIndex] ?? "Saturday",
    dateLabel,
    type: "monitoring",
    label: "Performance review",
    serviceType: "Reporting",
  };
}

/**
 * Resolve the hard campaign window from Media Plan data.
 * `requestedStartDate` is the business Campaign Start when present;
 * grid Saturday (`scheduledStartDate`) is never preferred over requested.
 */
export function resolveCampaignWindowFromMediaPlan(
  data: Pick<
    MediaPlanData,
    "requestedStartDate" | "campaignStartDate" | "scheduledStartDate" | "campaignEndDate" | "durationWeeks"
  >
): CampaignWindow | null {
  const startIso =
    data.requestedStartDate?.trim() ||
    data.campaignStartDate?.trim() ||
    data.scheduledStartDate?.trim() ||
    null;
  if (!startIso || !parseIsoCampaignDate(startIso)) return null;

  const endIso =
    (data.campaignEndDate?.trim() && parseIsoCampaignDate(data.campaignEndDate)
      ? data.campaignEndDate.trim()
      : null) ||
    resolveBusinessCampaignEndIso({
      campaignStartIso: startIso,
      campaignEndIso: data.campaignEndDate,
      durationWeeks: data.durationWeeks,
    });
  if (!endIso) return null;

  return { startIso, endIso };
}

export function isIsoWithinCampaignWindow(iso: string, window: CampaignWindow): boolean {
  const date = parseIsoCampaignDate(iso);
  const start = parseIsoCampaignDate(window.startIso);
  const end = parseIsoCampaignDate(window.endIso);
  if (!date || !start || !end) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function compareIsoDates(a: string, b: string): number {
  const da = parseIsoCampaignDate(a);
  const db = parseIsoCampaignDate(b);
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
}

type GridSlot = {
  week: number;
  dayIndex: number;
  dateIso: string;
  dateLabel: string;
};

function listGridSlots(data: MediaPlanData): GridSlot[] {
  const gridStart = parseIsoCampaignDate(data.scheduledStartDate ?? data.campaignStartDate);
  if (!gridStart) return [];
  const slots: GridSlot[] = [];
  for (const week of [...data.weeks].sort((a, b) => a.week - b.week)) {
    week.days.forEach((_day, dayIndex) => {
      const date = dateForCampaignSlot(gridStart, week.week, dayIndex);
      slots.push({
        week: week.week,
        dayIndex,
        dateIso: toIsoCampaignDate(date),
        dateLabel: formatShortCampaignDate(date),
      });
    });
  }
  return slots;
}

/** In-window publishing days only (hard constraint surface). */
export function listCampaignWindowSlots(
  data: MediaPlanData,
  window: CampaignWindow
): GridSlot[] {
  return listGridSlots(data).filter((slot) => isIsoWithinCampaignWindow(slot.dateIso, window));
}

/** Find every occupied creator/deliverable slot outside the campaign window. */
export function findCampaignWindowViolations(
  data: MediaPlanData,
  window?: CampaignWindow | null
): CampaignWindowViolation[] {
  const resolved = window ?? resolveCampaignWindowFromMediaPlan(data);
  if (!resolved) return [];

  const gridStart = parseIsoCampaignDate(data.scheduledStartDate ?? data.campaignStartDate);
  if (!gridStart) return [];

  const violations: CampaignWindowViolation[] = [];
  for (const week of data.weeks) {
    week.days.forEach((day, dayIndex) => {
      if (!dayHasCreatorPublishing(day)) return;
      const dateIso = toIsoCampaignDate(dateForCampaignSlot(gridStart, week.week, dayIndex));
      if (isIsoWithinCampaignWindow(dateIso, resolved)) return;
      const reason: CampaignWindowViolation["reason"] =
        compareIsoDates(dateIso, resolved.startIso) < 0 ? "before_start" : "after_end";
      violations.push({
        week: week.week,
        dayIndex,
        dateIso,
        reason,
        creatorId: day.creatorId,
        creator: day.creator,
        label: day.label,
      });
    });
  }
  return violations;
}

/**
 * Final validation gate — rejects any publishing slot outside the campaign window.
 * Call before persisting a Media Plan.
 */
export function assertMediaPlanWithinCampaignWindow(data: MediaPlanData): void {
  const window = resolveCampaignWindowFromMediaPlan(data);
  if (!window) {
    throw new MediaPlanCampaignWindowError(
      "Media Plan is missing Campaign Start/End dates required for window validation.",
      []
    );
  }
  const violations = findCampaignWindowViolations(data, window);
  if (!violations.length) return;

  const sample = violations
    .slice(0, 3)
    .map((v) => `${v.dateIso}${v.creator ? ` (${v.creator})` : ""}`)
    .join(", ");
  throw new MediaPlanCampaignWindowError(
    `Publishing slots fall outside the campaign window ${window.startIso} – ${window.endIso}: ${sample}` +
      (violations.length > 3 ? ` (+${violations.length - 3} more)` : ""),
    violations
  );
}

function toAdditional(day: MediaPlanDay): MediaPlanAdditionalDeliverable {
  return {
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
  };
}

/**
 * Rebalance creator publishing into the campaign window only.
 * No-op when already compliant. When violations exist, preserves creator order and
 * compresses cadence into in-window slots (overrides spacing/optimisation).
 */
export function rebalanceMediaPlanWithinCampaignWindow(
  data: MediaPlanData,
  window?: CampaignWindow | null
): MediaPlanData {
  const resolved = window ?? resolveCampaignWindowFromMediaPlan(data);
  if (!resolved) return data;

  // Hard constraint already satisfied — do not reshuffle a valid plan.
  if (!findCampaignWindowViolations(data, resolved).length) {
    return {
      ...data,
      campaignEndDate: data.campaignEndDate ?? resolved.endIso,
      requestedStartDate: data.requestedStartDate ?? resolved.startIso,
    };
  }

  const gridStart = parseIsoCampaignDate(data.scheduledStartDate ?? data.campaignStartDate);
  if (!gridStart) return data;

  const occupied: MediaPlanDay[] = [];
  for (const week of [...data.weeks].sort((a, b) => a.week - b.week)) {
    for (const day of week.days) {
      if (dayHasCreatorPublishing(day)) occupied.push(day);
    }
  }

  const windowSlots = listCampaignWindowSlots(data, resolved);
  const priorByKey = new Map(
    data.weeks.flatMap((week) =>
      week.days.map((day, dayIndex) => [`${week.week}:${dayIndex}`, day] as const)
    )
  );

  // Start from a clean grid: empty inside/outside; restore monitoring shells inside window only when unused.
  const weeks: MediaPlanWeek[] = data.weeks.map((week) => ({
    ...week,
    days: week.days.map((_day, dayIndex) => {
      const dateLabel = formatShortCampaignDate(
        dateForCampaignSlot(gridStart, week.week, dayIndex)
      );
      const dateIso = toIsoCampaignDate(dateForCampaignSlot(gridStart, week.week, dayIndex));
      const prior = priorByKey.get(`${week.week}:${dayIndex}`);
      if (
        prior?.type === "monitoring" &&
        isIsoWithinCampaignWindow(dateIso, resolved) &&
        !dayHasCreatorPublishing(prior)
      ) {
        return monitoringDay(dayIndex, dateLabel);
      }
      return emptyDay(dayIndex, dateLabel);
    }),
  }));

  const weekMap = new Map(weeks.map((w) => [w.week, w]));

  const placeAt = (slot: GridSlot, content: MediaPlanDay) => {
    const week = weekMap.get(slot.week);
    if (!week) return;
    const existing = week.days[slot.dayIndex]!;
    if (!dayHasCreatorPublishing(existing)) {
      week.days[slot.dayIndex] = {
        ...content,
        day: PUBLISHING_CALENDAR_DAYS[slot.dayIndex] ?? content.day,
        dateLabel: slot.dateLabel,
      };
      return;
    }
    const extras: MediaPlanAdditionalDeliverable[] = [
      ...(existing.additionalDeliverables ?? []),
      toAdditional(content),
      ...(content.additionalDeliverables ?? []),
    ];
    week.days[slot.dayIndex] = {
      ...existing,
      additionalDeliverables: extras,
      dateLabel: slot.dateLabel,
    };
  };

  if (windowSlots.length && occupied.length) {
    if (occupied.length <= windowSlots.length) {
      for (let i = 0; i < occupied.length; i += 1) {
        const targetIndex =
          occupied.length === 1
            ? 0
            : Math.round((i * (windowSlots.length - 1)) / (occupied.length - 1));
        placeAt(windowSlots[targetIndex]!, occupied[i]!);
      }
    } else {
      for (let i = 0; i < occupied.length; i += 1) {
        placeAt(windowSlots[Math.min(i, windowSlots.length - 1)]!, occupied[i]!);
      }
    }
  }

  return {
    ...data,
    weeks,
    deadlines: rebuildMediaPlanDeadlinesFromWeeks(
      weeks,
      data.scheduledStartDate ?? data.campaignStartDate
    ),
    campaignEndDate: resolved.endIso,
    requestedStartDate: data.requestedStartDate ?? resolved.startIso,
  };
}

/**
 * Enforce the hard campaign window: rebalance into the window, then validate.
 * Throws {@link MediaPlanCampaignWindowError} if any publishing slot remains outside.
 */
export function enforceMediaPlanCampaignWindow(data: MediaPlanData): MediaPlanData {
  const window = resolveCampaignWindowFromMediaPlan(data);
  if (!window) {
    throw new MediaPlanCampaignWindowError(
      "Cannot enforce campaign window — Campaign Start/End dates are missing.",
      []
    );
  }
  const balanced = rebalanceMediaPlanWithinCampaignWindow(data, window);
  assertMediaPlanWithinCampaignWindow(balanced);
  return balanced;
}

/** True when a calendar day ISO is outside the campaign window (for Generate skip). */
export function isPublishingDateBlockedByCampaignWindow(
  dateIso: string,
  window: CampaignWindow | null | undefined
): boolean {
  if (!window) return false;
  return !isIsoWithinCampaignWindow(dateIso, window);
}

/**
 * Resolve the absolute ISO date for a publishing-calendar slot
 * (week number + Sat–Fri day index) from Media Plan grid start.
 */
export function isoForMediaPlanSlot(
  data: Pick<MediaPlanData, "scheduledStartDate" | "campaignStartDate">,
  week: number,
  dayIndex: number
): string | null {
  const gridStart = parseIsoCampaignDate(data.scheduledStartDate ?? data.campaignStartDate);
  if (!gridStart) return null;
  return toIsoCampaignDate(dateForCampaignSlot(gridStart, week, dayIndex));
}

/**
 * Reject a manual schedule move whose target day falls outside Campaign Start–End.
 */
export function assertScheduleTargetWithinCampaignWindow(
  data: MediaPlanData,
  target: { week: number; dayIndex: number }
): void {
  const window = resolveCampaignWindowFromMediaPlan(data);
  if (!window) return;
  const dateIso = isoForMediaPlanSlot(data, target.week, target.dayIndex);
  if (!dateIso) return;
  if (isIsoWithinCampaignWindow(dateIso, window)) return;
  throw new MediaPlanCampaignWindowError(
    `Cannot schedule publishing on ${dateIso} — outside the campaign window ${window.startIso} – ${window.endIso}.`,
    [
      {
        week: target.week,
        dayIndex: target.dayIndex,
        dateIso,
        reason: compareIsoDates(dateIso, window.startIso) < 0 ? "before_start" : "after_end",
      },
    ]
  );
}
