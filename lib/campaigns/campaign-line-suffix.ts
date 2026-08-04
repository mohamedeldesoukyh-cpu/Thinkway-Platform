/**
 * Excel-style campaign line suffix from a zero-based index.
 * Mirrors SQL `public.campaign_line_suffix` (STAB-040).
 * 0→A … 25→Z · 26→AA · 27→AB
 */
export function campaignLineSuffix(zeroBasedIndex: number): string {
  if (!Number.isInteger(zeroBasedIndex) || zeroBasedIndex < 0) {
    throw new Error("campaignLineSuffix index must be a non-negative integer");
  }
  let n = zeroBasedIndex + 1;
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
