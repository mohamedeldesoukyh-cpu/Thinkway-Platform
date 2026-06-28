/** Fill-missing-only merge for CSV re-import — never overwrite non-empty existing values. */

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
 * Return incoming only when existing is empty; otherwise keep existing.
 * Logs `[import] field skipped` / `[import] field filled from upload`.
 */
export function mergeMissingOnly<T>(
  existing: T,
  incoming: T,
  field: string,
  log?: ImportMergeLog
): T {
  if (!isImportFieldEmpty(existing)) {
    log?.("info", `[import] field skipped (existing value present): ${field}`);
    return existing;
  }
  if (!isImportFieldEmpty(incoming)) {
    log?.("info", `[import] field filled from upload: ${field}`);
    return incoming;
  }
  return existing;
}

/** Shallow patch: only keys whose merged value differs from existing. */
export function mergeMissingOnlyRecord<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>,
  fieldLabels: Partial<Record<keyof T, string>>,
  log?: ImportMergeLog
): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(incoming) as Array<keyof T>) {
    const label = fieldLabels[key] ?? String(key);
    const merged = mergeMissingOnly(existing[key], incoming[key] as T[keyof T], label, log);
    if (merged !== existing[key]) {
      patch[key] = merged as T[keyof T];
    }
  }
  return patch;
}
