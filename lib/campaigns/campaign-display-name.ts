/**
 * Strip convert/quotation prefixes so CIO and headers show the campaign name only.
 * e.g. "Campaign — Quotation — Limitless UAE…" → "Limitless UAE…"
 */
export function resolveCampaignDisplayName(
  name: string | null | undefined
): string {
  let value = name?.trim() ?? "";
  if (!value) return "";

  let previous = "";
  while (value !== previous) {
    previous = value;
    value = value
      .replace(/^(Campaign\s*[—\-–:]\s*)+/i, "")
      .replace(/^(Quotation\s*[—\-–:]\s*)+/i, "")
      .trim();
  }

  return value || name?.trim() || "";
}
