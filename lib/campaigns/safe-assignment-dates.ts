import { format, isValid, parseISO } from "date-fns";

/** Parse YYYY-MM-DD (or ISO) without throwing. */
export function parseAssignmentDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const iso = trimmed.length <= 10 ? parseISO(`${trimmed}T00:00:00`) : parseISO(trimmed);
  if (isValid(iso)) return iso;

  const fallback = new Date(trimmed);
  return isValid(fallback) ? fallback : null;
}

export function safeFormatAssignmentDate(
  value: string | null | undefined,
  pattern = "d MMM"
): string {
  const date = parseAssignmentDate(value);
  if (!date) return "—";
  try {
    return format(date, pattern);
  } catch {
    return "—";
  }
}

export function safeSummarizePostingDates(
  liveDates: Array<string | null | undefined>
): string {
  const dates = liveDates
    .map((d) => parseAssignmentDate(d))
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return "—";
  if (dates.length === 1) return safeFormatAssignmentDate(dates[0].toISOString().slice(0, 10));
  const first = safeFormatAssignmentDate(dates[0].toISOString().slice(0, 10));
  const last = safeFormatAssignmentDate(dates[dates.length - 1].toISOString().slice(0, 10));
  return `${first}–${last}`;
}
