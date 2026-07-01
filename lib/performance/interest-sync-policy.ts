/**
 * Interest / category field protection during enrichment (Refresh Metrics).
 * Mirrors avatar-sync-policy: imported/manual values survive empty or partial Apify data.
 */

import type { FieldSource } from "@/lib/creator-enrichment/types";

/** Provenance for interest-related fields stored in `field_sources` jsonb. */
export type InterestFieldSource = FieldSource | "import" | "upload" | "ai";

export const INTEREST_PROTECTED_FIELDS = [
  "audience_interests",
  "interest_categories",
  "categories",
  "audience_country",
  "niche",
  "ai_categories",
  "brand_fit_categories",
] as const;

export type InterestProtectedField = (typeof INTEREST_PROTECTED_FIELDS)[number];

const INTEREST_ARRAY_FIELDS = new Set<InterestProtectedField>([
  "audience_interests",
  "interest_categories",
  "categories",
  "ai_categories",
  "brand_fit_categories",
]);

const LOW_CONFIDENCE_TOKENS = new Set(["unknown", "n/a", "na", "none", "null"]);

const PROTECTED_SOURCES = new Set<InterestFieldSource>([
  "manual",
  "imported",
  "import",
  "upload",
]);

export function isInterestProtectedField(field: string): field is InterestProtectedField {
  return (INTEREST_PROTECTED_FIELDS as readonly string[]).includes(field);
}

export function isInterestArrayField(field: InterestProtectedField): boolean {
  return INTEREST_ARRAY_FIELDS.has(field);
}

/** null, undefined, '', [], {}, [''], ['unknown'], ['n/a'] */
export function isEmptyInterestValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    const meaningful = value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !LOW_CONFIDENCE_TOKENS.has(item.toLowerCase()));
    return meaningful.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
}

export function normalizeInterestSource(
  value: string | null | undefined
): InterestFieldSource | undefined {
  switch (value) {
    case "manual":
    case "imported":
    case "import":
    case "upload":
    case "apify":
    case "ai":
    case "actual":
    case "forecast":
      return value;
    default:
      return undefined;
  }
}

export function isProtectedInterestSource(source: InterestFieldSource | undefined): boolean {
  return source != null && PROTECTED_SOURCES.has(source);
}

export function isInterestMergeEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.ENABLE_INTEREST_MERGE === "true";
}

function normalizeInterestToken(value: string): string {
  return value.trim().toLowerCase();
}

/** Dedupe merge — only genuinely new interests (case-insensitive). */
export function mergeInterestStringArrays(
  existing: string[] | null | undefined,
  incoming: string[] | null | undefined
): string[] {
  const existingValues = (existing ?? []).map((v) => v.trim()).filter(Boolean);
  const incomingValues = (incoming ?? []).map((v) => v.trim()).filter(Boolean);

  if (incomingValues.length === 0) return existingValues;
  if (existingValues.length === 0) return incomingValues;

  const seen = new Set(existingValues.map(normalizeInterestToken));
  const merged = [...existingValues];
  for (const value of incomingValues) {
    const key = normalizeInterestToken(value);
    if (LOW_CONFIDENCE_TOKENS.has(key) || seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }
  return merged;
}

/** Prefer the first non-empty interest array across column + metadata paths. */
export function coalesceInterestArrayValues(
  ...values: Array<string[] | null | undefined>
): string[] {
  for (const value of values) {
    if (!isEmptyInterestValue(value)) {
      return (value as string[]).map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
}

export function resolveInterestFieldSource(
  field: InterestProtectedField,
  fieldSources: Record<string, FieldSource | string | null | undefined> | null | undefined,
  metadata?: Record<string, unknown> | null
): InterestFieldSource | undefined {
  const direct = normalizeInterestSource(fieldSources?.[field] ?? undefined);
  if (direct) return direct;

  if (field === "interest_categories") {
    return (
      normalizeInterestSource(fieldSources?.audience_interests ?? undefined) ??
      normalizeInterestSource(fieldSources?.categories ?? undefined)
    );
  }

  if (field === "audience_interests" && metadata) {
    return normalizeInterestSource(fieldSources?.interest_categories ?? undefined);
  }

  return undefined;
}

export type InterestFieldMergeInput = {
  field: InterestProtectedField;
  existingValue: unknown;
  existingSource?: InterestFieldSource;
  incomingValue: unknown;
  incomingSource: InterestFieldSource;
  forceInterestReplace?: boolean;
  enableInterestMerge?: boolean;
};

export type InterestFieldMergeResult =
  | { action: "preserve"; log?: string }
  | { action: "skip"; log?: string }
  | { action: "write"; value: unknown; source: InterestFieldSource; log?: string };

export function resolveInterestFieldMerge(
  input: InterestFieldMergeInput
): InterestFieldMergeResult {
  const {
    field,
    existingValue,
    existingSource,
    incomingValue,
    incomingSource,
    forceInterestReplace = false,
    enableInterestMerge = isInterestMergeEnabled(),
  } = input;

  const existingEmpty = isEmptyInterestValue(existingValue);
  const incomingEmpty = isEmptyInterestValue(incomingValue);

  if (incomingEmpty) {
    if (!existingEmpty) {
      return {
        action: "preserve",
        log: `[interests] provider returned empty interests field=${field}`,
      };
    }
    return { action: "skip" };
  }

  if (existingEmpty) {
    return {
      action: "write",
      value: incomingValue,
      source: incomingSource,
    };
  }

  if (isProtectedInterestSource(existingSource) && !forceInterestReplace) {
    return {
      action: "preserve",
      log: `[interests] preserving imported interests field=${field}`,
    };
  }

  if (forceInterestReplace) {
    return {
      action: "write",
      value: incomingValue,
      source: incomingSource,
      log: `[interests] replaced interests (force=true) field=${field}`,
    };
  }

  if (isInterestArrayField(field) && enableInterestMerge) {
    const merged = mergeInterestStringArrays(
      existingValue as string[],
      incomingValue as string[]
    );
    const changed =
      JSON.stringify(merged) !== JSON.stringify(existingValue as string[] | null | undefined);
    if (!changed) {
      return {
        action: "preserve",
        log: `[interests] preserving imported interests field=${field}`,
      };
    }
    return {
      action: "write",
      value: merged,
      source: existingSource ?? incomingSource,
      log: `[interests] merged new interests field=${field}`,
    };
  }

  return {
    action: "preserve",
    log: `[interests] preserving imported interests field=${field}`,
  };
}

export type InterestMergeOptions = {
  forceInterestReplace?: boolean;
  enableInterestMerge?: boolean;
  metadata?: Record<string, unknown> | null;
};

/** Resolve existing value + source for a protected field (column + metadata). */
export function resolveInterestFieldContext(
  field: InterestProtectedField,
  existingValues: Record<string, unknown>,
  fieldSources: Record<string, FieldSource | string | null | undefined> | null | undefined,
  options?: InterestMergeOptions
): { existingValue: unknown; existingSource: InterestFieldSource | undefined } {
  const metadata = options?.metadata ?? null;

  if (field === "interest_categories") {
    const existingValue = coalesceInterestArrayValues(
      existingValues.interest_categories as string[] | undefined,
      metadata?.audience_interests as string[] | undefined,
      metadata?.categories as string[] | undefined,
      existingValues.audience_interests as string[] | undefined,
      existingValues.categories as string[] | undefined
    );
    return {
      existingValue,
      existingSource: resolveInterestFieldSource(field, fieldSources, metadata),
    };
  }

  if (field === "audience_interests") {
    const existingValue = coalesceInterestArrayValues(
      metadata?.audience_interests as string[] | undefined,
      existingValues.audience_interests as string[] | undefined,
      existingValues.interest_categories as string[] | undefined
    );
    return {
      existingValue,
      existingSource: resolveInterestFieldSource(field, fieldSources, metadata),
    };
  }

  if (field === "categories") {
    const existingValue = coalesceInterestArrayValues(
      metadata?.categories as string[] | undefined,
      existingValues.categories as string[] | undefined,
      existingValues.interest_categories as string[] | undefined,
      metadata?.audience_interests as string[] | undefined
    );
    return {
      existingValue,
      existingSource: resolveInterestFieldSource(field, fieldSources, metadata),
    };
  }

  const metadataValue = metadata?.[field];
  const columnValue = existingValues[field];
  const existingValue = isEmptyInterestValue(columnValue) ? metadataValue : columnValue;

  return {
    existingValue,
    existingSource: resolveInterestFieldSource(field, fieldSources, metadata),
  };
}
