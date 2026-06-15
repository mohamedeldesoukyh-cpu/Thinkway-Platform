const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function normalizeNumericInput(raw: string): string {
  let value = raw.trim();
  for (const [ar, en] of Object.entries(ARABIC_DIGITS)) {
    value = value.replaceAll(ar, en);
  }
  return value
    .replace(/\u00a0/g, " ")
    .replace(/USD|US\$|SAR|AED|KWD|EGP/gi, "")
    .replace(/[\u066C,]/g, "")
    .replace(/\s+/g, "")
    .replace(/^\$/, "")
    .replace(/\$$/, "");
}

/**
 * Parses monetary strings from historical Excel ($2,024, locales, trailing spaces).
 */
export function parseMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  const raw = String(value).trim();
  if (!raw || /^n\/?a$/i.test(raw) || /^-$/.test(raw)) return null;

  const negative = /^\(.*\)$/.test(raw) || raw.startsWith("-");
  const normalized = normalizeNumericInput(raw.replace(/[()]/g, ""));
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  const signed = negative ? -Math.abs(parsed) : parsed;
  return Math.round(signed * 100) / 100;
}

export function parseMoneyOrZero(value: unknown): number {
  return parseMoney(value) ?? 0;
}
