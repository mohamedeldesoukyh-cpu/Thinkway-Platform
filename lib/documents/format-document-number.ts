/**
 * Display-only formatting for Thinkway document numbers.
 * Storage / search / sequencing keep zero-padded canonical values (e.g. TW-2026-0001).
 */

const NUMERIC_SEGMENT = /^\d+$/;

function formatNumericToken(token: string): string {
  if (!NUMERIC_SEGMENT.test(token)) {
    return token;
  }
  const parsed = Number.parseInt(token, 10);
  return Number.isFinite(parsed) ? String(parsed) : token;
}

/** Strip leading zeros from numeric parts; supports VIO revision suffixes (0006/2). */
function formatDocumentSegment(segment: string): string {
  if (segment.includes("/")) {
    return segment.split("/").map(formatNumericToken).join("/");
  }
  return formatNumericToken(segment);
}

/**
 * Strip leading zeros from numeric hyphen segments; leave text segments unchanged.
 * TW-2026-0001 → TW-2026-1 · VIO-2026-0006/2 → VIO-2026-6/2 · INF-000002 → INF-2
 */
export function formatDocumentNumberForDisplay(
  value: string | null | undefined
): string {
  if (value == null) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  return trimmed.split("-").map(formatDocumentSegment).join("-");
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
