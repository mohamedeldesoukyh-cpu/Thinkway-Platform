/** Authoritative import merge — incoming non-empty values overwrite; empty incoming preserves existing. */

export function isImportFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
}

export type ImportMergeLog = (level: "info" | "warn", message: string) => void;

/**
 * Authoritative merge: when incoming is non-empty, use it; otherwise keep existing.
 * Never overwrites populated values with NULL/empty.
 */
export function mergeAuthoritative<T>(
  existing: T,
  incoming: T,
  field: string,
  log?: ImportMergeLog
): T {
  if (!isImportFieldEmpty(incoming)) {
    if (incoming !== existing) {
      log?.("info", `[import] field updated from upload: ${field}`);
    }
    return incoming;
  }
  if (!isImportFieldEmpty(existing)) {
    log?.("info", `[import] field skipped (empty in upload): ${field}`);
  }
  return existing;
}

/** @deprecated Use {@link mergeAuthoritative}. Kept for incremental migration. */
export const mergeMissingOnly = mergeAuthoritative;

/** Shallow patch: only keys whose merged value differs from existing. */
export function mergeAuthoritativeRecord<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>,
  fieldLabels: Partial<Record<keyof T, string>>,
  log?: ImportMergeLog
): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(incoming) as Array<keyof T>) {
    const label = fieldLabels[key] ?? String(key);
    const merged = mergeAuthoritative(
      existing[key],
      incoming[key] as T[keyof T],
      label,
      log
    );
    if (merged !== existing[key]) {
      patch[key] = merged as T[keyof T];
    }
  }
  return patch;
}

/** @deprecated Use {@link mergeAuthoritativeRecord}. */
export const mergeMissingOnlyRecord = mergeAuthoritativeRecord;
