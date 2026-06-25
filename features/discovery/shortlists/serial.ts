/**
 * Shortlist serials: SL-YYYY-NNNN (spec §1).
 * Sequential, resets yearly, permanent, never reused. Distinct prefix from
 * campaign serials (TW-YYYY-NNNN) so the two number spaces never collide.
 */
const SHORTLIST_SERIAL_RE = /^SL-(\d{4})-(\d{4,})$/;
const CAMPAIGN_SERIAL_RE = /^TW-(\d{4})-(\d{4,})$/;

export function shortlistSerialPrefix(year: number): string {
  return `SL-${year}`;
}

export function isValidShortlistSerial(value: string | null | undefined): boolean {
  if (!value) return false;
  return SHORTLIST_SERIAL_RE.test(value.trim());
}

/** Defensive guard: a shortlist serial must never look like a campaign serial. */
export function collidesWithCampaignSerial(
  value: string | null | undefined
): boolean {
  if (!value) return false;
  return CAMPAIGN_SERIAL_RE.test(value.trim());
}

export function parseShortlistSerialYear(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const match = SHORTLIST_SERIAL_RE.exec(value.trim());
  return match ? Number(match[1]) : null;
}
