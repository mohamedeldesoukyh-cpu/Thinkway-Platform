import type { ParsedCreatorRow } from "./types";

const COUNTRY_CODE_MAP: Record<string, string> = {
  jordan: "JO",
  uae: "AE",
  "united arab emirates": "AE",
  saudi: "SA",
  "saudi arabia": "SA",
  egypt: "EG",
  kuwait: "KW",
  qatar: "QA",
  bahrain: "BH",
  oman: "OM",
  lebanon: "LB",
  morocco: "MA",
  tunisia: "TN",
  algeria: "DZ",
  iraq: "IQ",
  usa: "US",
  "united states": "US",
  uk: "GB",
  "united kingdom": "GB",
};

export function resolveCountryCode(country: string | null | undefined): string | null {
  if (!country?.trim()) return null;
  const trimmed = country.trim();
  if (/^[A-Z]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return COUNTRY_CODE_MAP[trimmed.toLowerCase()] ?? null;
}

export function normalizeParsedCreatorRow(
  row: ParsedCreatorRow,
  defaultSource: string | null
): ParsedCreatorRow {
  return {
    ...row,
    username: row.username.trim().replace(/^@+/, ""),
    platform: row.platform.trim().toLowerCase(),
    country: row.country?.trim() || null,
    source: row.source?.trim() || defaultSource,
    categories: row.categories.map((value) => value.trim()).filter(Boolean),
    audience_interests: row.audience_interests
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export function buildCreatorImportMetadata(row: ParsedCreatorRow): Record<string, unknown> {
  return {
    import_source: row.source,
    audience_interests: row.audience_interests,
    relevance_score: row.relevance_score,
    imported_at: new Date().toISOString(),
  };
}

/** Union of influencer-level categories and imported category/interest tags. */
export function resolveInfluencerImportCategories(
  existing: string[] | null | undefined,
  row: Pick<ParsedCreatorRow, "categories" | "audience_interests">
): string[] {
  return mergeImportedStringArrays(
    mergeImportedStringArrays(existing, row.categories),
    row.audience_interests
  );
}

export function mergeImportedStringArrays(
  existing: string[] | null | undefined,
  imported: string[] | null | undefined
): string[] {
  const existingValues = (existing ?? []).filter(Boolean);
  const importedValues = (imported ?? []).filter(Boolean);

  if (importedValues.length === 0) {
    return existingValues;
  }
  if (existingValues.length === 0) {
    return importedValues;
  }

  const seen = new Set(existingValues.map((value) => value.toLowerCase()));
  const merged = [...existingValues];
  for (const value of importedValues) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(value);
    }
  }
  return merged;
}

export function mergeCreatorImportMetadata(
  existing: Record<string, unknown>,
  row: ParsedCreatorRow
): Record<string, unknown> {
  const importMeta = buildCreatorImportMetadata(row);

  return {
    ...existing,
    ...importMeta,
    audience_interests: mergeImportedStringArrays(
      existing.audience_interests as string[] | undefined,
      row.audience_interests
    ),
    categories: mergeImportedStringArrays(
      existing.categories as string[] | undefined,
      row.categories
    ),
    relevance_score:
      row.relevance_score != null
        ? row.relevance_score
        : ((existing.relevance_score as number | null | undefined) ?? null),
    import_source: row.source ?? existing.import_source ?? importMeta.import_source,
    imported_at: importMeta.imported_at,
  };
}
