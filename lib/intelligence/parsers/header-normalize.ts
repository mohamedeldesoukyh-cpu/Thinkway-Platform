/**
 * Normalizes Excel column headers for case-insensitive, whitespace- and
 * punctuation-tolerant field lookup across historical workbook tabs.
 */
export function normalizeExcelHeader(key: string): string {
  return key
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\(\s*/g, " ( ")
    .replace(/\s*\)/g, " ) ")
    .replace(/\$\s*/g, " $ ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildNormalizedRowLookup(row: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    map.set(normalizeExcelHeader(key), value);
  }
  return map;
}

export function lookupCell(
  row: Map<string, unknown>,
  ...aliases: string[]
): string | null {
  for (const alias of aliases) {
    const value = row.get(normalizeExcelHeader(alias));
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

export function lookupValue(row: Map<string, unknown>, ...aliases: string[]): unknown {
  for (const alias of aliases) {
    const normalized = normalizeExcelHeader(alias);
    if (row.has(normalized)) return row.get(normalized);
  }
  return undefined;
}

export function hasMoneyInRow(row: Map<string, unknown>, ...aliases: string[]): boolean {
  for (const alias of aliases) {
    const value = lookupValue(row, alias);
    if (value == null || value === "") continue;
    if (typeof value === "number") return true;
    if (/\d/.test(String(value))) return true;
  }
  return false;
}
