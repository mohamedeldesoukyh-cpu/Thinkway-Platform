/**
 * Display-only formatting for Thinkway document numbers.
 * Storage / search / sequencing keep zero-padded canonical values (e.g. TW-2026-0001).
 *
 * Campaign headers/lines: UI shows Camp#YYYY-N (and Camp#YYYY-N-A) so “TW” is not
 * confused with Thinkway product branding. DB still stores TW-YYYY-NNNN.
 */

const NUMERIC_SEGMENT = /^\d+$/;
/** Canonical campaign header/line prefix in storage. */
const CAMPAIGN_STORAGE_PREFIX = "TW";
/** User-facing campaign prefix (replaces TW- on display only). */
const CAMPAIGN_DISPLAY_PREFIX = "Camp#";

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

function stripDisplayZeros(value: string): string {
  return value.split("-").map(formatDocumentSegment).join("-");
}

/**
 * TW-2026-0001 → Camp#2026-1 · TW-2026-0001-A → Camp#2026-1-A
 * Non-campaign docs keep their own prefixes (VIO-, INF-, CIO-, …).
 */
function toCampaignDisplayForm(trimmed: string): string | null {
  const match = trimmed.match(/^TW-(\d{4})-(.+)$/i);
  if (!match) return null;
  const year = match[1]!;
  const rest = stripDisplayZeros(match[2]!);
  return `${CAMPAIGN_DISPLAY_PREFIX}${year}-${rest}`;
}

/**
 * Camp#2026-1 / Camp#2026-1-A → TW-2026-1 / TW-2026-1-A (unpadded) for lookup.
 */
function fromCampaignDisplayForm(trimmed: string): string | null {
  const match = trimmed.match(/^Camp#(\d{4})-(.+)$/i);
  if (!match) return null;
  return `${CAMPAIGN_STORAGE_PREFIX}-${match[1]}-${match[2]}`;
}

/**
 * Strip leading zeros from numeric hyphen segments; leave text segments unchanged.
 * Campaign: TW-2026-0001 → Camp#2026-1 · line TW-2026-0001-A → Camp#2026-1-A
 * Other: VIO-2026-0006/2 → VIO-2026-6/2 · INF-000002 → INF-2
 */
export function formatDocumentNumberForDisplay(
  value: string | null | undefined
): string {
  if (value == null) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const campaignDisplay = toCampaignDisplayForm(trimmed);
  if (campaignDisplay) return campaignDisplay;

  return stripDisplayZeros(trimmed);
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

/**
 * Lookup candidates for route/document resolution.
 * Display forms (INF-10483, Camp#2026-1) also try common zero-padded storage forms.
 */
export function documentNumberLookupCandidates(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const asStorage = fromCampaignDisplayForm(trimmed) ?? trimmed;
  const candidates = [trimmed];
  if (asStorage !== trimmed) {
    candidates.push(asStorage);
  }

  const segments = asStorage.split("-");
  if (segments.length < 2) return candidates;

  const lastIdx = segments.length - 1;
  const last = segments[lastIdx]!;
  const revisionMatch = last.match(/^(\d+)(\/\d+)?$/);
  if (!revisionMatch) {
    // Line suffix form TW-2026-1-A — pad the serial segment (index 2).
    if (
      segments[0]?.toUpperCase() === CAMPAIGN_STORAGE_PREFIX &&
      segments.length >= 3 &&
      NUMERIC_SEGMENT.test(segments[2]!)
    ) {
      const serialIdx = 2;
      const digits = segments[serialIdx]!;
      for (const pad of [4, 5, 6, 7, 8]) {
        if (digits.length >= pad) continue;
        const next = [...segments];
        next[serialIdx] = digits.padStart(pad, "0");
        candidates.push(next.join("-"));
      }
    }
    return candidates;
  }

  const digits = revisionMatch[1]!;
  const revisionSuffix = revisionMatch[2] ?? "";
  for (const pad of [4, 5, 6, 7, 8]) {
    if (digits.length >= pad) continue;
    const next = [...segments];
    next[lastIdx] = `${digits.padStart(pad, "0")}${revisionSuffix}`;
    candidates.push(next.join("-"));
  }
  return candidates;
}
