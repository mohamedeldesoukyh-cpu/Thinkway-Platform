/**
 * Media Plan week anchoring.
 *
 * Scheduling modes (product):
 * - `calendar_week` (current default): Week 1 is the Monday on/after the requested
 *   start. Day columns are always Monday–Sunday.
 * - `campaign_relative_week` (future): Week 1 day 0 = the requested start date even
 *   when mid-week; columns are campaign-relative rather than calendar Mon–Sun.
 *
 * Only `calendar_week` is implemented today. Do not invent mid-week Week-1 anchors
 * until campaign_relative_week ships.
 */

/** How Week 1 is anchored relative to the user-requested campaign start. */
export type MediaPlanWeekSchedulingMode = "calendar_week" | "campaign_relative_week";

/** Product default until campaign-relative mode is implemented. */
export const DEFAULT_MEDIA_PLAN_WEEK_SCHEDULING_MODE: MediaPlanWeekSchedulingMode =
  "calendar_week";

/** Monday on or after the given anchor date (local calendar). */
export function startOfCampaignWeek(anchor = new Date()): Date {
  const date = new Date(anchor);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  if (daysUntilMonday > 0) date.setDate(date.getDate() + daysUntilMonday);
  return date;
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

/** Monday of Week 1 for a requested campaign start (YYYY-MM-DD). */
export function resolveScheduledStartDate(requestedIso: string): string | null {
  const requested = parseIsoCampaignDate(requestedIso);
  if (!requested) return null;
  return toIsoCampaignDate(startOfCampaignWeek(requested));
}

export function formatCampaignDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/**
 * When Calendar Week mode must start later than the requested go-live day,
 * return a user-facing explanation. Null when dates already align.
 */
export function describeMondayAlignment(
  requestedIso: string,
  scheduledIso: string
): string | null {
  if (requestedIso === scheduledIso) return null;
  return (
    `Calendar Week mode: publishing weeks run Monday–Sunday, so Week 1 begins ` +
    `${formatCampaignDateLabel(scheduledIso)} (the Monday on or after ` +
    `${formatCampaignDateLabel(requestedIso)}). ` +
    `Your requested go-live date (${formatCampaignDateLabel(requestedIso)}) is kept; ` +
    `only the publishing calendar is Monday-aligned.`
  );
}
