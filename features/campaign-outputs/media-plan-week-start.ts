/**
 * Media Plan weeks are Mon–Sun grids (dayIndex 0 = Monday).
 * When the user requests a mid-week campaign start, Week 1 anchors to the
 * Monday on or after that date so calendar columns stay correct.
 */

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
 * When the publishing calendar must start later than the requested go-live day,
 * return a user-facing explanation. Null when dates already align.
 */
export function describeMondayAlignment(
  requestedIso: string,
  scheduledIso: string
): string | null {
  if (requestedIso === scheduledIso) return null;
  return (
    `Publishing calendar weeks run Monday–Sunday, so Week 1 begins ` +
    `${formatCampaignDateLabel(scheduledIso)} (the Monday on or after ` +
    `${formatCampaignDateLabel(requestedIso)}).`
  );
}
