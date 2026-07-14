import { formatShortCampaignDate } from "./generators/media-plan";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseCampaignStartDate(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

export function dateForCampaignSlot(start: Date, week: number, dayIndex: number): Date {
  const date = new Date(start);
  date.setDate(date.getDate() + (week - 1) * 7 + dayIndex);
  return date;
}

/** e.g. "20 – 26 Jul 2026" */
export function formatWeekRangeLabel(start: Date, week: number): string {
  const weekStart = dateForCampaignSlot(start, week, 0);
  const weekEnd = dateForCampaignSlot(start, week, 6);
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const endMonth = MONTH_SHORT[weekEnd.getMonth()] ?? "";
  const endYear = weekEnd.getFullYear();
  return `${startDay} – ${endDay} ${endMonth} ${endYear}`;
}

export function formatDayColumnDate(start: Date, week: number, dayIndex: number): string {
  return formatShortCampaignDate(dateForCampaignSlot(start, week, dayIndex));
}
