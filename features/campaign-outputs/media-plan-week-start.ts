/**
 * Publishing Calendar week anchoring (SSOT).
 *
 * The Publishing Calendar is **calendar-based**, not campaign-relative:
 * - Weeks run **Saturday → Friday** (business calendar).
 * - Week 1 starts on the Saturday of the calendar week that contains the campaign start.
 * - The last week ends on the Friday of the calendar week that contains the campaign end.
 * - Every overlapping Saturday–Friday week is rendered (including partial campaign weeks).
 * - Campaign dates select the active range; they do not redefine week boundaries.
 *
 * Revise: when campaign dates change, recalculate the calendar range and rebind slots
 * by absolute date — preserve creators / publishing slots / strategy unless Regenerated.
 */

/** How Week 1 is anchored relative to the user-requested campaign start. */
export type MediaPlanWeekSchedulingMode = "calendar_week" | "campaign_relative_week";

/** Product default — Saturday–Friday calendar weeks. */
export const DEFAULT_MEDIA_PLAN_WEEK_SCHEDULING_MODE: MediaPlanWeekSchedulingMode =
  "calendar_week";

/** Day columns for the Publishing Calendar (index 0 = Saturday). */
export const PUBLISHING_CALENDAR_DAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export type PublishingCalendarDay = (typeof PUBLISHING_CALENDAR_DAYS)[number];

export const PUBLISHING_CALENDAR_DAY_ABBR = [
  "Sat",
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
] as const;

/** Saturday on or before the given anchor date (local calendar). */
export function startOfPublishingWeek(anchor = new Date()): Date {
  const date = new Date(anchor);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay(); // Sun=0 … Sat=6
  const daysSinceSaturday = (day + 1) % 7;
  if (daysSinceSaturday > 0) date.setDate(date.getDate() - daysSinceSaturday);
  return date;
}

/** @deprecated Use {@link startOfPublishingWeek}. Kept as alias for call-site migration. */
export function startOfCampaignWeek(anchor = new Date()): Date {
  return startOfPublishingWeek(anchor);
}

/** Friday that ends the Saturday–Friday week containing the anchor. */
export function endOfPublishingWeek(anchor = new Date()): Date {
  const start = startOfPublishingWeek(anchor);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

/** Parse YYYY-MM-DD into a local noon Date, or null when invalid. */
export function parseIsoCampaignDate(iso: string): Date | null {
  const trimmed = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [year, month, day] = trimmed.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toIsoCampaignDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Saturday that opens the publishing week containing the requested campaign start.
 * This is the Publishing Calendar grid anchor — not a forward snap past the start date.
 */
export function resolveScheduledStartDate(requestedIso: string): string | null {
  const requested = parseIsoCampaignDate(requestedIso);
  if (!requested) return null;
  return toIsoCampaignDate(startOfPublishingWeek(requested));
}

export function formatCampaignDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/**
 * Inclusive campaign end date from business start + duration weeks
 * (start + durationWeeks×7 − 1 day).
 */
export function resolveCampaignEndDate(
  startIso: string,
  durationWeeks: number
): string | null {
  const start = parseIsoCampaignDate(startIso);
  if (!start || !Number.isFinite(durationWeeks) || durationWeeks < 1) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + Math.round(durationWeeks) * 7 - 1);
  return toIsoCampaignDate(end);
}

export type PublishingCalendarWeek = {
  /** 1-based Week N label for the rendered Publishing Calendar. */
  week: number;
  /** Saturday that opens this calendar week. */
  start: Date;
  /** Friday that closes this calendar week. */
  end: Date;
  startIso: string;
  endIso: string;
};

export type PublishingCalendarRange = {
  /** Business campaign start (may be mid-week). */
  campaignStartIso: string;
  /** Business campaign end (may be mid-week). */
  campaignEndIso: string;
  /** First Saturday of the range. */
  gridStartSaturday: Date;
  gridStartIso: string;
  /** Last Friday of the range. */
  gridEndFriday: Date;
  gridEndIso: string;
  weeks: PublishingCalendarWeek[];
};

/**
 * Enumerate every Saturday–Friday calendar week overlapping [campaignStart, campaignEnd].
 * Partial weeks at either end are included — they are real publishing weeks.
 */
export function resolvePublishingCalendarRange(
  campaignStartIso: string,
  campaignEndIso: string
): PublishingCalendarRange | null {
  const start = parseIsoCampaignDate(campaignStartIso);
  const end = parseIsoCampaignDate(campaignEndIso);
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) return null;

  const gridStartSaturday = startOfPublishingWeek(start);
  const gridEndFriday = endOfPublishingWeek(end);
  const weeks: PublishingCalendarWeek[] = [];

  let cursor = new Date(gridStartSaturday);
  let week = 1;
  while (cursor.getTime() <= gridEndFriday.getTime() && week <= 104) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({
      week,
      start: new Date(cursor),
      end: weekEnd,
      startIso: toIsoCampaignDate(cursor),
      endIso: toIsoCampaignDate(weekEnd),
    });
    cursor.setDate(cursor.getDate() + 7);
    week += 1;
  }

  return {
    campaignStartIso,
    campaignEndIso,
    gridStartSaturday,
    gridStartIso: toIsoCampaignDate(gridStartSaturday),
    gridEndFriday,
    gridEndIso: toIsoCampaignDate(gridEndFriday),
    weeks,
  };
}

/** Resolve business end: explicit ISO, else start + duration weeks. */
export function resolveBusinessCampaignEndIso(input: {
  campaignStartIso: string;
  campaignEndIso?: string | null;
  durationWeeks?: number | null;
}): string | null {
  const explicit = input.campaignEndIso?.trim();
  if (explicit && parseIsoCampaignDate(explicit)) return explicit;
  const weeks = input.durationWeeks;
  if (weeks == null || !Number.isFinite(weeks)) return null;
  return resolveCampaignEndDate(input.campaignStartIso, weeks);
}

/**
 * Optional Copilot note when the publishing grid opens before the campaign start
 * (mid-week start inside a Saturday–Friday week).
 */
export function describePublishingCalendarAlignment(
  requestedIso: string,
  gridStartIso: string
): string | null {
  if (requestedIso === gridStartIso) return null;
  return (
    `The Publishing Calendar uses Saturday–Friday weeks, so the first calendar week begins ` +
    `${formatCampaignDateLabel(gridStartIso)} (campaign starts mid-week).`
  );
}

/** @deprecated Use {@link describePublishingCalendarAlignment}. */
export function describeMondayAlignment(
  requestedIso: string,
  scheduledIso: string
): string | null {
  return describePublishingCalendarAlignment(requestedIso, scheduledIso);
}
