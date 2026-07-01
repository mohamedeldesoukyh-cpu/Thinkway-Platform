/**
 * Pure, testable merge logic for creator enrichment.
 *
 * Two guarantees (spec §11):
 *  1. TRANSPARENCY — every written field records its source in `field_sources`.
 *  2. MANUAL PROTECTION — a field whose existing source is `manual` is NEVER
 *     overwritten by automated enrichment.
 *
 * Demographics (spec §6) are normalized with a strict "never invent" rule: when
 * a provider gives nothing, every demographic column stays NULL and
 * demographic_source = 'unavailable'.
 */

import {
  isInterestProtectedField,
  resolveInterestFieldContext,
  resolveInterestFieldMerge,
  type InterestMergeOptions,
} from "@/lib/performance/interest-sync-policy";

import type {
  DemographicSource,
  FieldSource,
  FieldSourceMap,
} from "./types";

export type IncomingField = {
  field: string;
  value: unknown;
  source: FieldSource;
};

export type MergeResult = {
  /** Column => value to persist (only fields that changed / are allowed). */
  updates: Record<string, unknown>;
  /** New per-field source map (merged over the existing one). */
  fieldSources: FieldSourceMap;
  /** Names of fields actually written. */
  fieldsUpdated: string[];
  /** Names of fields skipped because they are manually protected. */
  manualProtected: string[];
};

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Sources that must not be overwritten by automated enrichment. */
function isProtectedFieldSource(source: FieldSource | undefined): boolean {
  return source === "manual" || source === "imported";
}

/**
 * Merge incoming enriched fields onto existing field sources, honoring manual
 * protection and recording transparency sources.
 */
export type MergeSourcedFieldsOptions = {
  /** Existing column values — used for fill-missing-only enrichment. */
  existingValues?: Record<string, unknown>;
  /**
   * When true (default), only overwrite non-empty values when the existing
   * source is `apify`. Manual/imported values are always preserved.
   */
  fillMissingOnly?: boolean;
  /**
   * @deprecated Discovery refresh no longer bypasses import/manual protection.
   */
  ignoreManualProtectionFor?: readonly string[];
  /** Platform account metadata — used for imported audience_interests / categories. */
  metadata?: Record<string, unknown> | null;
  /** Replace imported/manual interests with provider values (Discovery opt-in). */
  forceInterestReplace?: boolean;
  /** Merge only genuinely new interests when ENABLE_INTEREST_MERGE=true. */
  enableInterestMerge?: boolean;
};

export function mergeSourcedFields(
  existingSources: FieldSourceMap | null | undefined,
  incoming: IncomingField[],
  options?: MergeSourcedFieldsOptions
): MergeResult {
  const fieldSources: FieldSourceMap = { ...(existingSources ?? {}) };
  const updates: Record<string, unknown> = {};
  const fieldsUpdated: string[] = [];
  const manualProtected: string[] = [];
  const ignoreManual = new Set(options?.ignoreManualProtectionFor ?? []);
  const fillMissingOnly = options?.fillMissingOnly !== false;
  const existingValues = options?.existingValues ?? {};
  const interestOptions: InterestMergeOptions = {
    forceInterestReplace: options?.forceInterestReplace,
    enableInterestMerge: options?.enableInterestMerge,
    metadata: options?.metadata,
  };

  for (const item of incoming) {
    if (isInterestProtectedField(item.field)) {
      const context = resolveInterestFieldContext(
        item.field,
        existingValues,
        fieldSources,
        interestOptions
      );
      const decision = resolveInterestFieldMerge({
        field: item.field,
        existingValue: context.existingValue,
        existingSource: context.existingSource,
        incomingValue: item.value,
        incomingSource: item.source,
        forceInterestReplace: options?.forceInterestReplace,
        enableInterestMerge: options?.enableInterestMerge,
      });

      if (decision.log) {
        console.log(decision.log);
      }

      if (decision.action === "preserve" || decision.action === "skip") {
        if (decision.action === "preserve") {
          manualProtected.push(item.field);
        }
        continue;
      }

      updates[item.field] = decision.value;
      fieldSources[item.field] = decision.source as FieldSource;
      fieldsUpdated.push(item.field);
      continue;
    }

    // Never overwrite with empty/null — keeps existing data intact.
    if (isEmpty(item.value)) continue;

    const existingSource = fieldSources[item.field];
    const existingValue = existingValues[item.field];
    const hasExistingValue = !isEmpty(existingValue);
    const protectedSource = isProtectedFieldSource(existingSource);

    // MANUAL / IMPORT PROTECTION: operator or CSV-sourced fields stay locked.
    if (
      protectedSource &&
      item.source !== "manual" &&
      item.source !== "imported" &&
      !ignoreManual.has(item.field)
    ) {
      manualProtected.push(item.field);
      continue;
    }

    // Fill-missing-only: keep any non-empty value unless it came from Apify.
    if (
      fillMissingOnly &&
      hasExistingValue &&
      existingSource !== "apify" &&
      item.source === "apify" &&
      !ignoreManual.has(item.field)
    ) {
      manualProtected.push(item.field);
      continue;
    }

    updates[item.field] = item.value;
    fieldSources[item.field] = item.source;
    fieldsUpdated.push(item.field);
  }

  return { updates, fieldSources, fieldsUpdated, manualProtected };
}

export type DemographicColumns = {
  audience_age_13_17: number | null;
  audience_age_18_24: number | null;
  audience_age_25_34: number | null;
  audience_age_35_44: number | null;
  audience_age_45_54: number | null;
  audience_age_55_plus: number | null;
  audience_gender_male: number | null;
  audience_gender_female: number | null;
  audience_gender_unknown: number | null;
  audience_top_countries: Array<{ code?: string; name?: string; percent?: number }> | null;
  audience_top_cities: Array<{ name?: string; percent?: number }> | null;
  demographic_source: DemographicSource;
};

const NULL_DEMOGRAPHICS: DemographicColumns = {
  audience_age_13_17: null,
  audience_age_18_24: null,
  audience_age_25_34: null,
  audience_age_35_44: null,
  audience_age_45_54: null,
  audience_age_55_plus: null,
  audience_gender_male: null,
  audience_gender_female: null,
  audience_gender_unknown: null,
  audience_top_countries: null,
  audience_top_cities: null,
  demographic_source: "unavailable",
};

export type RawDemographics = {
  age?: Partial<{
    "13_17": number;
    "18_24": number;
    "25_34": number;
    "35_44": number;
    "45_54": number;
    "55_plus": number;
  }> | null;
  gender?: Partial<{ male: number; female: number; unknown: number }> | null;
  topCountries?: Array<{ code?: string; name?: string; percent?: number }> | null;
  topCities?: Array<{ name?: string; percent?: number }> | null;
  source?: DemographicSource;
};

function pct(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

/**
 * Normalize provider demographics into typed columns. NEVER estimates: if the
 * provider supplies nothing usable, returns all-NULL + 'unavailable'.
 */
export function normalizeDemographics(
  raw: RawDemographics | null | undefined
): DemographicColumns {
  if (!raw) return { ...NULL_DEMOGRAPHICS };

  const age = raw.age ?? null;
  const gender = raw.gender ?? null;
  const countries =
    Array.isArray(raw.topCountries) && raw.topCountries.length > 0
      ? raw.topCountries
      : null;
  const cities =
    Array.isArray(raw.topCities) && raw.topCities.length > 0 ? raw.topCities : null;

  const cols: DemographicColumns = {
    audience_age_13_17: pct(age?.["13_17"]),
    audience_age_18_24: pct(age?.["18_24"]),
    audience_age_25_34: pct(age?.["25_34"]),
    audience_age_35_44: pct(age?.["35_44"]),
    audience_age_45_54: pct(age?.["45_54"]),
    audience_age_55_plus: pct(age?.["55_plus"]),
    audience_gender_male: pct(gender?.male),
    audience_gender_female: pct(gender?.female),
    audience_gender_unknown: pct(gender?.unknown),
    audience_top_countries: countries,
    audience_top_cities: cities,
    demographic_source: raw.source ?? "unavailable",
  };

  const hasAny =
    cols.audience_age_13_17 != null ||
    cols.audience_age_18_24 != null ||
    cols.audience_age_25_34 != null ||
    cols.audience_age_35_44 != null ||
    cols.audience_age_45_54 != null ||
    cols.audience_age_55_plus != null ||
    cols.audience_gender_male != null ||
    cols.audience_gender_female != null ||
    cols.audience_gender_unknown != null ||
    cols.audience_top_countries != null ||
    cols.audience_top_cities != null;

  // "Never invent": no real data => unavailable, regardless of declared source.
  if (!hasAny) return { ...NULL_DEMOGRAPHICS };

  return cols;
}

/** True when a demographics column set carries actual data. */
export function hasDemographics(cols: DemographicColumns): boolean {
  return cols.demographic_source !== "unavailable";
}
