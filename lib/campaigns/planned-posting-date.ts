/** Planned dates are independent of actual publication/live dates. */
export function plannedPostingDate(metadata?: Record<string, unknown> | null): string | null {
  const value = metadata?.planned_posting_date;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
export function validPostingDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function formatPlannedPostingDates(dates: Array<string | null | undefined>): string {
  const values = [...new Set(dates.filter((date): date is string => Boolean(date && validPostingDate(date))))].sort();
  if (!values.length) return "—";
  const label = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));
  return values.length === 1 ? label(values[0]) : `${label(values[0])} – ${label(values[values.length - 1])}`;
}
