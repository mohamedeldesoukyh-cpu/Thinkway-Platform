import { prepareCreatorAvatarUrlForDisplay } from "@/lib/performance/creator-avatar";
import {
  isUsableAvatarUrl,
  type AvatarSource,
} from "@/lib/performance/avatar-sync-policy";

import type { FieldSource, FieldSourceMap } from "@/lib/creator-enrichment/types";

import { mergeMissingOnly, type ImportMergeLog } from "./merge";

import type { ParsedCreatorRow } from "./types";

const IMPORTED: FieldSource = "imported";

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
    profile_picture_url: row.profile_picture_url?.trim() || null,
    profile_avatar_source: row.profile_avatar_source ?? null,
    role: row.role?.trim() || null,
  };
}

/** Record per-field provenance for CSV-sourced platform account columns. */
export function buildImportFieldSources(
  row: Pick<
    ParsedCreatorRow,
    | "followers"
    | "engagement_rate"
    | "country"
    | "categories"
    | "audience_interests"
    | "profile_picture_url"
    | "role"
  >,
  options?: { hasAvatar?: boolean }
): FieldSourceMap {
  const sources: FieldSourceMap = {};
  if (row.followers != null) sources.follower_count = IMPORTED;
  if (row.engagement_rate != null) sources.engagement_rate = IMPORTED;
  if (row.country?.trim()) sources.audience_country = IMPORTED;
  if (row.categories.length > 0 || row.audience_interests.length > 0) {
    sources.interest_categories = IMPORTED;
  }
  if (options?.hasAvatar || row.profile_picture_url?.trim()) {
    sources.profile_picture_url = IMPORTED;
  }
  if (row.role?.trim()) sources.creator_role = IMPORTED;
  return sources;
}

/** Validate and normalize a CSV-provided profile photo URL for platform account storage. */
export function resolveImportProfilePictureUrl(
  url: string | null | undefined,
  platform: string
): string | null {
  const trimmed = url?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed) || !isUsableAvatarUrl(trimmed)) {
    return null;
  }
  return prepareCreatorAvatarUrlForDisplay(platform, trimmed) ?? trimmed;
}

export function importProfilePictureAccountFields(
  url: string | null | undefined,
  platform: string,
  avatarSource: AvatarSource = "manual"
): {
  profile_picture_url: string;
  avatar_source: AvatarSource;
  avatar_last_synced_at: string;
} | null {
  const profilePictureUrl = resolveImportProfilePictureUrl(url, platform);
  if (!profilePictureUrl) return null;
  return {
    profile_picture_url: profilePictureUrl,
    avatar_source: avatarSource,
    avatar_last_synced_at: new Date().toISOString(),
  };
}

export function buildCreatorImportMetadata(row: ParsedCreatorRow): Record<string, unknown> {
  return {
    import_source: row.source,
    audience_interests: row.audience_interests,
    relevance_score: row.relevance_score,
    ...(row.role?.trim() ? { role: row.role.trim() } : {}),
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

/** Re-import metadata merge — only fill empty fields; always refresh provenance timestamps. */
export function mergeCreatorImportMetadataMissingOnly(
  existing: Record<string, unknown>,
  row: ParsedCreatorRow,
  log?: ImportMergeLog
): Record<string, unknown> {
  const importMeta = buildCreatorImportMetadata(row);
  const incomingCategories = resolveInfluencerImportCategories([], row);
  const incomingInterests = row.audience_interests;

  return {
    ...existing,
    audience_interests: mergeMissingOnly(
      (existing.audience_interests as string[] | undefined) ?? [],
      incomingInterests,
      "metadata.audience_interests",
      log
    ),
    categories: mergeMissingOnly(
      (existing.categories as string[] | undefined) ?? [],
      incomingCategories,
      "metadata.categories",
      log
    ),
    relevance_score: mergeMissingOnly(
      (existing.relevance_score as number | null | undefined) ?? null,
      row.relevance_score,
      "metadata.relevance_score",
      log
    ),
    role: mergeMissingOnly(
      (existing.role as string | null | undefined) ?? null,
      row.role?.trim() || null,
      "metadata.role",
      log
    ),
    import_source: row.source ?? existing.import_source ?? importMeta.import_source,
    imported_at: importMeta.imported_at,
  };
}
