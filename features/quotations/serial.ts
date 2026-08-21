/**
 * Quotation serials: QT-YYYY-NNNN (spec §8).
 * Generated entirely in Postgres via `generate_quotation_serial()`; this module
 * only validates/parses format. Sequential, resets yearly, retained forever,
 * never reused. Distinct prefix from campaigns (TW-) and shortlists (SL-).
 */
const QUOTATION_SERIAL_RE = /^QT-(\d{4})-(\d{4,})$/;
const CAMPAIGN_SERIAL_RE = /^TW-(\d{4})-(\d{4,})$/;
const SHORTLIST_SERIAL_RE = /^SL-(\d{4})-(\d{4,})$/;

export function quotationSerialPrefix(year: number): string {
  return `QT-${year}`;
}

export function isValidQuotationSerial(value: string | null | undefined): boolean {
  if (!value) return false;
  return QUOTATION_SERIAL_RE.test(value.trim());
}

/** Defensive guard: a quotation serial must not collide with other serial spaces. */
export function collidesWithOtherSerial(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return CAMPAIGN_SERIAL_RE.test(trimmed) || SHORTLIST_SERIAL_RE.test(trimmed);
}

export function parseQuotationSerialYear(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const match = QUOTATION_SERIAL_RE.exec(value.trim());
  return match ? Number(match[1]) : null;
}

/** Numeric QT-YYYY-NNNN sequence only. Version suffixes ( -V2 ) are ignored. */
export function parseQuotationBaseSequence(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const match = QUOTATION_SERIAL_RE.exec(value.trim());
  return match ? Number(match[2]) : null;
}

/** Next QT sequence after both the allocator cursor and surviving base serials. */
export function nextQuotationSequenceValue(
  lastValue: number,
  existingSerials: string[]
): number {
  let maxExisting = 0;
  for (const serial of existingSerials) {
    const parsed = parseQuotationBaseSequence(serial);
    if (parsed != null && parsed > maxExisting) maxExisting = parsed;
  }
  return Math.max(lastValue, maxExisting) + 1;
}
