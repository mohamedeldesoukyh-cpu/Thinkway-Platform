/** UTC month helpers for historical series. */

export function toPeriodMonth(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for period month: ${String(input)}`);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function previousPeriodMonth(periodMonth: string): string {
  const date = new Date(`${periodMonth}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return toPeriodMonth(date);
}
