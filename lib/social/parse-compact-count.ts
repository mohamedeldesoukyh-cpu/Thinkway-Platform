/** Parse compact social counts such as 1.7M, 279K, or 1,234,567. */
export function parseCompactCount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/,/g, "");
  const match = cleaned.match(/^([\d.]+)\s*([kmb])?$/i);
  if (!match) {
    const digits = Number(cleaned.replace(/[^\d.]/g, ""));
    return Number.isFinite(digits) ? Math.round(digits) : null;
  }

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return Math.round(base * 1_000);
  if (suffix === "m") return Math.round(base * 1_000_000);
  if (suffix === "b") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}
