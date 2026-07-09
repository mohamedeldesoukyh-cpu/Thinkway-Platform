import { COMMERCIAL_CURRENCIES } from "../commercial/fx-aggregation";

const CURRENCY_SYMBOLS = /[$€£¥₹₽]/g;

/** Strip currency codes/symbols and grouping so pasted values become plain numbers. */
export function sanitizeNumericInput(value: string): string {
  let cleaned = value.trim();
  for (const code of COMMERCIAL_CURRENCIES) {
    cleaned = cleaned.replace(new RegExp(`\\b${code}\\b`, "gi"), " ");
  }
  cleaned = cleaned
    .replace(CURRENCY_SYMBOLS, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/^US(?=\d)/i, "");

  const match = cleaned.match(/-?\d+(?:\.\d+)?|-?\.\d+/);
  return match?.[0] ?? cleaned;
}

export function parseDecimalInput(value: string): number {
  const cleaned = sanitizeNumericInput(value);
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseUnitsInput(value: string): number {
  const cleaned = sanitizeNumericInput(value);
  const n = Math.floor(Number(cleaned));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function formatNumDisplay(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

/** Insert sanitized paste text at the current caret/selection. */
export function mergePastedNumericText(
  current: string,
  pasted: string,
  selectionStart: number | null,
  selectionEnd: number | null
): string {
  const sanitized = sanitizeNumericInput(pasted);
  const start = selectionStart ?? current.length;
  const end = selectionEnd ?? current.length;
  return current.slice(0, start) + sanitized + current.slice(end);
}
