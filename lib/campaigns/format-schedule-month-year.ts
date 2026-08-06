/** Format a calendar date as MM/YY for CIO roster scheduled dates. */
export function formatScheduleMonthYear(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value.trim()}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

export function formatScheduleMonthYearRange(
  dates: Array<string | null | undefined>
): string {
  const formatted = [
    ...new Set(
      dates
        .map((date) => formatScheduleMonthYear(date))
        .filter((value): value is string => Boolean(value))
    ),
  ];
  if (formatted.length === 0) return "—";
  if (formatted.length === 1) return formatted[0]!;
  return `${formatted[0]} – ${formatted[formatted.length - 1]}`;
}
