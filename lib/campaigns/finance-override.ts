export function hasActiveFinanceOverride(until: string | null | undefined): boolean {
  if (!until) return false;
  const ts = new Date(until).getTime();
  return Number.isFinite(ts) && ts > Date.now();
}
