/**
 * Parses percentage strings (37%, 58.62 %, 0.37 as ratio).
 */
export function parsePercent(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value <= 1) return Math.round(value * 10000) / 100;
    return Math.round(value * 100) / 100;
  }

  const raw = String(value).trim().replace(/\u00a0/g, " ");
  if (!raw || /^n\/?a$/i.test(raw)) return null;

  const hasPercent = raw.includes("%");
  const numeric = raw.replace(/%/g, "").replace(/,/g, "").trim();
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;

  if (!hasPercent && parsed >= 0 && parsed <= 1) {
    return Math.round(parsed * 10000) / 100;
  }

  return Math.round(parsed * 100) / 100;
}
