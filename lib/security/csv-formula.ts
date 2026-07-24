/**
 * Neutralize spreadsheet formula injection (CWE-1236) for CSV / Excel exports.
 * Cells beginning with = + - @ tab or CR are prefixed with a single quote.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function needsSpreadsheetFormulaNeutralization(value: string): boolean {
  return FORMULA_PREFIX.test(value);
}

/**
 * Return a string/number safe for spreadsheet cells.
 * Finite numbers are left numeric (Excel stores them as numbers, not formulas).
 */
export function neutralizeSpreadsheetFormula(
  value: string | number | null | undefined
): string | number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value == null) return "";
  const text = String(value);
  if (text.length === 0) return "";
  if (needsSpreadsheetFormulaNeutralization(text)) {
    return `'${text}`;
  }
  return text;
}

/** RFC-style CSV cell: formula-safe + quote-escaped. */
export function csvEscapeCell(value: string | number | null | undefined): string {
  const neutralized = neutralizeSpreadsheetFormula(value);
  const text = String(neutralized);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Join a CSV row with formula-safe cells. */
export function csvEscapeRow(
  values: Array<string | number | null | undefined>
): string {
  return values.map(csvEscapeCell).join(",");
}
