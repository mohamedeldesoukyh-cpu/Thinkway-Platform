export type PnlPeriodScope = "fy" | "q1" | "q2" | "q3" | "q4" | "h1" | "h2";

export const PNL_PERIOD_OPTIONS: Array<{ value: PnlPeriodScope; label: string }> = [
  { value: "fy", label: "Full year" },
  { value: "q1", label: "Q1" },
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
  { value: "q4", label: "Q4" },
  { value: "h1", label: "H1" },
  { value: "h2", label: "H2" },
];

export function monthKeysForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
}

export function monthsForScope(year: number, scope: PnlPeriodScope): string[] {
  const all = monthKeysForYear(year);
  switch (scope) {
    case "q1":
      return all.slice(0, 3);
    case "q2":
      return all.slice(3, 6);
    case "q3":
      return all.slice(6, 9);
    case "q4":
      return all.slice(9, 12);
    case "h1":
      return all.slice(0, 6);
    case "h2":
      return all.slice(6, 12);
    case "fy":
    default:
      return all;
  }
}

export function periodScopeLabel(scope: PnlPeriodScope): string {
  return PNL_PERIOD_OPTIONS.find((option) => option.value === scope)?.label ?? "Full year";
}

export function formatPnLMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short" });
}

export function parsePnlPeriodScope(value: string | undefined): PnlPeriodScope {
  const allowed: PnlPeriodScope[] = ["fy", "q1", "q2", "q3", "q4", "h1", "h2"];
  return allowed.includes(value as PnlPeriodScope) ? (value as PnlPeriodScope) : "fy";
}

export function parsePnlYear(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 2020 || parsed > 2100) {
    return fallback;
  }
  return parsed;
}
