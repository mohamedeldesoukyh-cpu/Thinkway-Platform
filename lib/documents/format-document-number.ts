/**
 * Display-only formatting for Thinkway document numbers.
 * Storage / search / sequencing keep zero-padded canonical values (e.g. TW-2026-0001).
 */

const NUMERIC_SEGMENT = /^\d+$/;

/**
 * Strip leading zeros from numeric hyphen segments; leave text segments unchanged.
 * TW-2026-0001 → TW-2026-1 · TW-2026-0001-A → TW-2026-1-A · INF-000002 → INF-2
 */
export function formatDocumentNumberForDisplay(
  value: string | null | undefined
): string {
  if (value == null) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  return trimmed
    .split("-")
    .map((segment) => {
      if (!NUMERIC_SEGMENT.test(segment)) {
        return segment;
      }
      const parsed = Number.parseInt(segment, 10);
      return Number.isFinite(parsed) ? String(parsed) : segment;
    })
    .join("-");
}

/** True when display form differs from stored value (use for native tooltips). */
export function documentNumberDisplayTitle(
  canonical: string | null | undefined
): string | undefined {
  if (canonical == null) return undefined;
  const trimmed = canonical.trim();
  if (!trimmed) return undefined;
  const display = formatDocumentNumberForDisplay(trimmed);
  return display !== trimmed ? trimmed : undefined;
}
