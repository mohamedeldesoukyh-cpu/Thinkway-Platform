import { isValid, parseISO } from "date-fns";

import {
  formatDesignDate,
  formatDesignDateRange,
} from "@/lib/design/format-design-date";

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

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function safeFormatAssignmentDate(
  value: string | null | undefined,
  _pattern = "d MMM"
): string {
  void _pattern;
  return formatDesignDate(value);
}

export function safeSummarizePostingDates(
  liveDates: Array<string | null | undefined>
): string {
  const dates = liveDates
    .map((d) => parseAssignmentDate(d))
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return formatDesignDate(null);
  if (dates.length === 1) return formatDesignDate(toLocalYmd(dates[0]!));
  return formatDesignDateRange(toLocalYmd(dates[0]!), toLocalYmd(dates[dates.length - 1]!));
}
