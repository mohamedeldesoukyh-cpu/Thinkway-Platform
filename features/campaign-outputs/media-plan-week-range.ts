import { formatShortCampaignDate } from "./generators/media-plan";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseCampaignStartDate(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

/** Absolute date for Publishing Calendar slot (week 1-based, dayIndex 0 = Saturday). */
export function dateForCampaignSlot(start: Date, week: number, dayIndex: number): Date {
  const date = new Date(start);
  date.setDate(date.getDate() + (week - 1) * 7 + dayIndex);
  return date;
}

/** e.g. "11 – 17 Jul 2026" or "28 Jun – 4 Jul 2026" */
export function formatWeekDateRange(weekStart: Date, weekEnd: Date): string {
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const startMonth = MONTH_SHORT[weekStart.getMonth()] ?? "";
  const endMonth = MONTH_SHORT[weekEnd.getMonth()] ?? "";
  const endYear = weekEnd.getFullYear();
  if (weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear()) {
    return `${startDay} – ${endDay} ${endMonth} ${endYear}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
}

/** e.g. "11 – 17 Jul 2026" from grid Saturday + week number. */
export function formatWeekRangeLabel(start: Date, week: number): string {
  const weekStart = dateForCampaignSlot(start, week, 0);
  const weekEnd = dateForCampaignSlot(start, week, 6);
  return formatWeekDateRange(weekStart, weekEnd);
}

export function formatDayColumnDate(start: Date, week: number, dayIndex: number): string {
  return formatShortCampaignDate(dateForCampaignSlot(start, week, dayIndex));
}
